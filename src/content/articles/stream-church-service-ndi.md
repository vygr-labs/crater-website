---
title: Put lyrics and scripture on your church live stream with NDI · Crater
description: Send song lyrics and Bible verses from Crater into OBS, vMix or Streamlabs over your church network with NDI. No capture card, with a separate lower third look for the stream.
heading: Lyrics and scripture on your live stream
lede: Your online congregation wants to sing along too. Crater sends the words straight into OBS or vMix over your network, with no capture card and no extra cable.
related: [church-projector-setup, how-to-project-bible-verses, propresenter-alternative]
---

Pointing a camera at the projector screen works, but the words come out blurry and washed out. A capture card works better, but it costs money and ties the stream computer to the projection computer with a cable. NDI is a third way. It sends video over your ordinary church network, and streaming software like OBS, vMix and Streamlabs can receive it.

Crater has NDI built in on Windows.

## What you need

- **Crater on Windows** on the projection computer.
- **NDI Tools**, free from [ndi.video/tools](https://ndi.video/tools/), installed on the Crater computer.
- **Streaming software that receives NDI.** OBS Studio needs the DistroAV plugin (formerly obs-ndi). vMix and Streamlabs have NDI input built in.
- **Both computers on the same network.** A wired connection is the most reliable.

## Setting it up

1. Install NDI Tools on the Crater computer and restart Crater. An **NDI** button appears in the top bar.
2. Click **NDI** to start the stream. The button turns cyan.
3. In your streaming software, add an NDI source and pick the one named after the Crater computer, like **CHURCH-PC (Crater Live)**.
4. Put a verse on the screen in Crater and check it arrives.

The [NDI guide](/docs/features/ndi-streaming) covers every setting, including what each colour of the NDI button means.

## Give the stream its own look

Full-screen lyrics look right on a projector but cover the camera shot on a stream. Turn on **Dual output mode** in Crater's NDI settings, then set a separate song theme and scripture theme for the stream, such as a lower third. The projector keeps its full-screen look and the stream gets the words across the bottom of the picture.

## Handy during the service

- **Hide NDI** blanks the stream without touching the projector, for a private prayer time or a notice you don't want online.
- **Hide pictures and video** keeps lyrics and scripture on the stream but blanks videos you don't have the rights to broadcast.
- On a slow laptop, **on-demand rendering** only sends a new frame when something changes.

## No projector at all?

The NDI stream works whether or not the projection window is open. A church that only streams can run Crater on one laptop and send the words straight to the stream.
