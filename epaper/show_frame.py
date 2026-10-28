#!/usr/bin/env python3
"""Show the latest Your Life frame on a Waveshare 7.5-inch e-paper panel.

The GitHub Action in this repository renders months.png, years.png and
weeks.png once a day on the "frame" branch. This script downloads the one for
the current unit, shows it on the panel, refreshes once a day, and steps to
the next unit when the button is pressed.

Usage:
  show_frame.py            run forever: show, refresh daily, watch the button
  show_frame.py --once     show the current unit once and exit
  show_frame.py --unit years --once
  show_frame.py --test     write the panel image to /tmp/your-life-frame.png
                           instead of driving the panel (no hardware needed)
"""
import argparse
import io
import logging
import os
import sys
import threading
import time
import urllib.request
from datetime import datetime, timedelta

from PIL import Image

REPO = os.environ.get("YOUR_LIFE_REPO", "namquist/your-life")
BRANCH = os.environ.get("YOUR_LIFE_BRANCH", "frame")
UNITS = ["months", "years", "weeks"]
BUTTON_PIN = int(os.environ.get("YOUR_LIFE_BUTTON", "5"))  # BCM 5, header pin 29
REFRESH_HOUR = int(os.environ.get("YOUR_LIFE_REFRESH_HOUR", "6"))  # local time
PANEL_SIZE = (800, 480)
HOME = os.path.expanduser("~/.your-life")
STATE_FILE = os.path.join(HOME, "unit")
CACHE_DIR = os.path.join(HOME, "frames")

log = logging.getLogger("your-life")


def frame_url(unit):
    return "https://raw.githubusercontent.com/%s/%s/%s.png" % (REPO, BRANCH, unit)


def fetch(unit):
    """Download the frame, keeping a copy so the panel still works offline."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cached = os.path.join(CACHE_DIR, unit + ".png")
    try:
        req = urllib.request.Request(frame_url(unit), headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(cached, "wb") as fh:
            fh.write(data)
        log.info("downloaded %s (%d bytes)", unit, len(data))
    except Exception as err:  # noqa: BLE001
        if not os.path.exists(cached):
            raise
        log.warning("download failed (%s); showing the cached %s frame", err, unit)
    return Image.open(cached)


def to_panel(img):
    """Black and white, exactly the panel's size."""
    img = img.convert("L")
    if img.size != PANEL_SIZE:
        img = img.resize(PANEL_SIZE)
    return img.point(lambda p: 255 if p > 128 else 0, mode="1")


def show(unit, test=False):
    img = to_panel(fetch(unit))
    if test:
        out = "/tmp/your-life-frame.png"
        img.save(out)
        log.info("test mode: wrote %s", out)
        return
    from waveshare_epd import epd7in5_V2  # the black-and-white 7.5-inch V2 HAT
    epd = epd7in5_V2.EPD()
    epd.init()
    epd.display(epd.getbuffer(img))
    epd.sleep()
    log.info("panel updated with %s", unit)


def load_unit():
    try:
        with open(STATE_FILE) as fh:
            unit = fh.read().strip()
        if unit in UNITS:
            return unit
    except OSError:
        pass
    return UNITS[0]


def save_unit(unit):
    os.makedirs(HOME, exist_ok=True)
    with open(STATE_FILE, "w") as fh:
        fh.write(unit)


def seconds_until_next_refresh():
    now = datetime.now()
    nxt = now.replace(hour=REFRESH_HOUR, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--once", action="store_true", help="show once and exit")
    ap.add_argument("--unit", choices=UNITS, help="which view to show")
    ap.add_argument("--test", action="store_true", help="write an image instead of driving the panel")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    unit = args.unit or load_unit()
    save_unit(unit)
    lock = threading.Lock()

    def refresh(reason):
        with lock:
            try:
                show(load_unit(), test=args.test)
            except Exception as err:  # noqa: BLE001
                log.error("could not update the panel (%s): %s", reason, err)

    refresh("start")
    if args.once:
        return

    # The button steps to the next unit. gpiozero is only needed here.
    try:
        from gpiozero import Button

        def on_press():
            current = load_unit()
            save_unit(UNITS[(UNITS.index(current) + 1) % len(UNITS)])
            refresh("button")

        button = Button(BUTTON_PIN, pull_up=True, bounce_time=0.2)
        button.when_pressed = on_press
        log.info("button on BCM %d steps through %s", BUTTON_PIN, ", ".join(UNITS))
    except Exception as err:  # noqa: BLE001
        log.warning("no button: %s", err)

    while True:
        wait = seconds_until_next_refresh()
        log.info("next refresh in %.0f minutes", wait / 60)
        time.sleep(wait)
        refresh("daily")


if __name__ == "__main__":
    sys.exit(main())
