# The e-paper frame

A Raspberry Pi Zero 2 W drives a Waveshare 7.5-inch black-and-white e-paper panel
(800 × 480) in a picture frame. Once a day it downloads a fresh image of the
website and shows it. A push button steps between months, years and weeks.

The website never knows the hardware exists. Any page renders in **e-paper mode**
when its address carries `?epaper=1`: white background, black cells, no controls,
both grids on one screen, and `&dob=YYYY-MM-DD` fills in the birthday. For example:

    months.html?epaper=1&dob=1995-08-15

Add `&scale=calendar` or `&scale=felt` for a single, larger grid.

## How the pieces fit

1. **GitHub Actions** (`.github/workflows/frame.yml`) runs every morning, renders
   the three pages at 800 × 480 with headless Chrome, and publishes
   `months.png`, `years.png` and `weeks.png` on a branch named `frame`.
2. **The Pi** (`epaper/show_frame.py`) downloads the image for the current unit,
   turns it into one-bit black and white, and pushes it to the panel. It refreshes
   at 6 am local time and whenever the button is pressed. It keeps the last images
   on disk, so the panel still shows yesterday's frame if the network is down.

## Parts

- Raspberry Pi Zero 2 W with headers, plus a microSD card and a 5 V power supply.
- Waveshare 7.5-inch e-Paper HAT, 800 × 480, black and white (the "V2" panel;
  the driver below is for that one).
- A momentary push button and two jumper wires.
- A picture frame deep enough for the Pi, about 5 × 7 inches, with a mat cut to
  the panel's active area (163 × 98 mm).

## One-time setup on GitHub

1. In the fork's **Settings → Secrets and variables → Actions**, add a secret
   named `DOB` with your birthday as `YYYY-MM-DD`. The secret stays private;
   the rendered images on the `frame` branch are public, like the rest of the
   fork, and show how many cells are filled.
2. Optionally add a repository **variable** named `TZ`, for example
   `America/New_York`, so the frame flips to the new day at your midnight.
3. Open the **Actions** tab and enable workflows (GitHub switches scheduled
   workflows off in forks until you do). Run "Render e-paper frames" once by hand
   from that tab and check that a `frame` branch appears with `months.png`.
4. GitHub pauses scheduled workflows after 60 days without a push to the
   repository. If the frame stops updating, run the workflow by hand once, or
   push any small change.

## Setting up the Pi

1. Flash Raspberry Pi OS Lite (64-bit) with the imager, with Wi-Fi and SSH set up
   in the imager's settings. Boot it and log in.
2. Turn on SPI: `sudo raspi-config` → Interface Options → SPI → Yes.
3. Install the libraries:

       sudo apt update
       sudo apt install -y git python3-pil python3-numpy python3-gpiozero python3-spidev python3-rpi.gpio
       git clone https://github.com/waveshare/e-Paper
       cd e-Paper/RaspberryPi_JetsonNano/python && sudo python3 setup.py install && cd ~

4. Get this repository and try it without the panel attached:

       git clone https://github.com/namquist/your-life
       python3 your-life/epaper/show_frame.py --once --test
       # writes /tmp/your-life-frame.png; copy it to your laptop to look at it

5. Seat the HAT on the GPIO header, wire the button between **BCM 5 (header pin
   29)** and **ground (header pin 30)**, and show the real thing:

       python3 your-life/epaper/show_frame.py --once

6. Make it start at boot:

       sudo cp your-life/epaper/your-life.service /etc/systemd/system/
       sudo systemctl enable --now your-life
       journalctl -u your-life -f     # watch the log

## Settings

Environment variables, set in the service file under `[Service]` as
`Environment=NAME=value` if you need to change them:

| Variable | Default | Meaning |
|---|---|---|
| `YOUR_LIFE_REPO` | `namquist/your-life` | which repository's `frame` branch to read |
| `YOUR_LIFE_BUTTON` | `5` | BCM pin of the button |
| `YOUR_LIFE_REFRESH_HOUR` | `6` | local hour of the daily refresh |

## Notes

- Months is the right unit for a 7.5-inch panel: 36 cells to a row, about 3 mm
  each. Weeks has 90 rows and comes out at about 1 mm per cell, which is
  readable as a texture but not as individual weeks.
- The panel takes a few seconds to redraw and flashes while it does; that is
  normal for e-paper. It holds the image with no power.
- `epaper/render.sh months 1995-08-15 out.png` renders the same image on a laptop
  with Chrome, for checking changes to the site before they reach the frame.
