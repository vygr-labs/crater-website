---
title: How to add a Bible translation to Crater · Crater
description: Import a licensed Bible into Crater from a Zefania, OpenSong, OSIS, USFM or USX file, or straight from a zip. What to check before you add one, and how to lay out a zip so it imports in one go.
heading: How to add a Bible translation to Crater
lede: Crater comes with ten public domain English translations. If your church reads from another one, you can add it from a file in a couple of minutes.
related: [how-to-project-bible-verses, free-church-presentation-software, church-projector-setup]
---

Maybe your congregation reads in Yoruba, Swahili or French. Maybe you need a Catholic Bible with Tobit and the books of Maccabees, or a newer edition than the one Crater ships. Any of these can be added from a file, and once it's in, it works like the built-in translations. It shows up in the sidebar, you can type references in it, and full-text search finds its verses.

## Check the licence first

A Bible translation is somebody's work. The older ones, like the King James Version, the American Standard Version and Young's Literal Translation, are in the public domain, and so is the World English Bible. Most modern translations are not. Projecting them in church is usually allowed, but the publisher decides how their text may be copied and passed on.

Before you add a translation, make sure your church may use it in this way. Good places to find files you're allowed to use:

- **[eBible.org](https://ebible.org)** has more than a thousand translations in hundreds of languages, most under open licences, with USFM downloads for each.
- **The publisher.** Many publishers license their text to churches for projection. Ask them for a file in one of the formats below.
- **Your Bible society.** National Bible societies often hold the rights to the translations in their languages, and many will help churches that ask.

Don't download a copyrighted translation from a sharing site and pass it around. If you're not sure, ask the publisher. Most are glad to be asked.

## Formats Crater reads

| Format | What it looks like |
|--------|--------------------|
| Zefania XML | One `.xml` file for the whole Bible |
| OpenSong | One file for the whole Bible, often with no extension |
| OSIS | One `.xml` or `.osis` file for the whole Bible |
| USFM | One file per book, ending `.usfm` or `.sfm` |
| USX | One file per book, ending `.usx` |

Any of these can also come in a zip. You don't need to unzip it first.

## Add the translation

1. Open Settings with the **gear** button in the top bar or **Ctrl + ,**, and go to **Scripture**.
2. Click **Add a Bible from a file...**.
3. Choose the Bible file or the zip. For USFM or USX files that aren't zipped, select all the book files in the folder at once.
4. Crater shows how many books and verses it found. Check the name, and pick a short code such as `YOR` or `NVI`. The code goes on the translation's card in the Scripture tab, and you type it after a reference to use it, as in `john 3:16 nvi`.
5. Click **Add Bible**.

A whole Bible takes a few seconds. You can open it in the Scripture tab straight from the last screen.

A Catholic Bible's extra books come in under their own names, in Catholic order. You can look up `tobit 1:1` or `sir 1:1` just as you would any other book. Additions to Esther and Daniel stay in those books with the chapter numbers your Bible uses.

## How to lay out a zip

Most downloads already import as they come. If you're putting a zip together yourself, to keep a translation on file or to send it to the team at another site, these are the rules:

- **One Bible per zip.** If Crater finds two Bibles in a zip, it says so and names them, rather than mixing them up.
- **Book files stay together.** For USFM or USX, keep every book of the Bible in one folder. The folder can be at any depth, so `release/USX_1/` from a Digital Bible Library bundle works.
- **Several formats of the same Bible are fine.** If the zip holds the same translation as OSIS, Zefania and USX, Crater reads one copy and tells you which. It prefers OSIS, then Zefania, because those two carry the translation's name and language.
- **Extra files are skipped.** Copyright pages, readme files, stylesheets and metadata are listed as skipped and nothing else happens.
- **No passwords.** Crater can't open encrypted zips.

A zip for one translation in book files looks like this:

```
YOR.zip
└── YOR/
    ├── 01-GEN.usfm
    ├── 02-EXO.usfm
    ├── ...
    ├── 66-REV.usfm
    └── copyright.txt
```

A zip with one translation in a single file is even simpler:

```
YOR.zip
├── YOR.osis.xml
└── copyright.txt
```

If you're sending several translations, make one zip for each and name each zip after its code. The person on the other end then adds them one at a time. Put the licence or copyright notice in each zip so it travels with the text, and only send translations whose licence lets you share them.

## If something doesn't look right

**"The zip holds more than one Bible."** The zip has several translations in it. Unzip it and choose the files of the one you want, or make a zip for each.

**"Not Bible files, so skipped."** This is only a note. Those files weren't scripture, so they were left out.

**"Some book names weren't ones Crater knows."** OpenSong files name books in the translation's own language. When a name isn't one Crater recognises, it places the book by its order in the file. Look up a few references after adding the Bible to check that they land where you expect.

**Removing a translation.** In Settings, under **Scripture**, a translation you added has a **Remove** button. The ones Crater comes with can be hidden by unticking them.

For everything else about verses on screen, see the [Scripture guide](/docs/features/scriptures).
