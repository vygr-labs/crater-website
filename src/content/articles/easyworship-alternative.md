---
title: A free EasyWorship alternative that keeps your songs · Crater
description: Crater is free worship projection software that imports your EasyWorship 6 or 7 song library directly, with titles, authors, CCLI numbers and verse labels intact.
heading: A free EasyWorship alternative
lede: Crater reads your EasyWorship 6 or 7 song library directly, so years of typed lyrics come with you. It's free, open source and runs on Windows, macOS and Linux.
related: [free-church-presentation-software, propresenter-alternative, church-projector-setup]
---

Most churches that look for something other than EasyWorship are weighing the licence cost, or they want to run services from a Mac or a Linux laptop. The worry that stops them is the song library. Nobody wants to retype hundreds of songs.

Crater was built with that in mind. Point it at your EasyWorship database and the whole library comes across in one go.

## What comes across from EasyWorship

The song import reads EasyWorship's own database files, `Songs.db` and `SongWords.db`, and brings over:

- Song titles and authors
- Copyright lines and CCLI numbers
- The lyrics, split into labelled verses and choruses ready to project

Songs you already have in Crater are spotted before anything is added, and you choose whether to skip them. EasyWorship doesn't need to be installed on the computer running Crater. Copying the two files across on a USB drive is enough.

Your pictures, backgrounds and videos are ordinary files in EasyWorship's Resources folder. You copy them into Crater's Media tab yourself, which takes about ten minutes. The [media import guide](/docs/guides/importing-media) shows where to find them and which video files to convert first.

## Side by side

| | Crater | EasyWorship |
|---|---|---|
| **Price** | Free, with no subscription | Paid licence. Check their site for current pricing |
| **Runs on** | Windows 10 and 11, macOS 14 or later, 64-bit Linux | Windows |
| **Source code** | Open source under the GPL | Closed source |
| **Your EasyWorship songs** | Imported directly from Songs.db and SongWords.db | Already there |

## What will feel familiar

The console works the way an EasyWorship operator expects. You pick a song or a verse in the library, check it in Preview, then send it Live. A schedule holds the order of service, and Clear and Logo buttons sit in the top bar for prayer times and the end of the service. Arrow keys move through slides and Enter sends them live, so a practised operator can run the whole service from the keyboard.

## What Crater adds

- **Fourteen Bible translations built in**, with lookup by reference (`jn 3:16`) or by the words you remember.
- **Strong's Greek and Hebrew definitions** you can put on the screen.
- **A stage monitor** for the preacher and the band, showing the words, speaker notes, what's next and a clock.
- **NDI output on Windows**, so lyrics and scripture go straight into OBS or vMix without a capture card.
- **A visual theme editor** with layers, gradients, shadows and your own fonts.
- **A console in 21 languages.**

## What to know before you switch

Crater can't load Bible translations of your own yet, so check the fourteen included ones cover what your church reads. NDI streaming is Windows only for now. On a Mac, Crater isn't signed with an Apple Developer ID yet, so the first launch needs one extra click, which the [installation guide](/docs/getting-started/installation#opening-crater-the-first-time) walks through.

## Switching in an afternoon

1. [Download Crater](/download) and install it on the projection computer.
2. Copy `Songs.db` and `SongWords.db` from the EasyWorship computer and [import them](/docs/guides/importing-songs).
3. Copy your pictures and videos into the Media tab.
4. Make a song theme and a scripture theme that match what your congregation is used to.
5. Let your volunteers try the [practice console](/playground) in a browser before Sunday.

Run Crater alongside EasyWorship for a week or two if you want a safety net. Because you import copies of the database files, EasyWorship's own library stays as it was.
