# Narration, and reading in Alpha's voice

Written for: Alpha and the B&A Developers team.

## What works now (updated 11 October 2026)

A **Listen** button is live in the reader. It reads the page that is open,
then waits. Turning the page (swipe, scroll, arrow keys or Next) reads the new
page. It never reads ahead of the page on screen. Pressing it again stops.

It uses the device's own speech engine, and picks a male English voice,
preferring West African English (Nigerian, Ghanaian), then East and South
African, then British, read slower and lower for a mature voice. Because these
voices belong to each device, a phone and a laptop will not sound identical,
and a device without a male English voice falls back to a lowered female one.
That is a hard limit of speech built into browsers.

**The only way to get one voice everywhere, offline included, is real audio
files.** That is now built:

* **Audio essays.** In the dashboard, Essays, attach an MP3 or M4A recording
  to any essay. It plays on the Listen page and in the reader ("Recording"
  button), and readers can save it to their phone for offline listening.
* **Narrate in my voice.** Once the ElevenLabs keys below are set, each essay
  in the dashboard gets a "Narrate in my voice" link. The server reads the
  essay in Alpha's cloned voice, stores the MP3, and it becomes an audio essay
  automatically, with a notification to app users.

### Setting up the cloned voice (about 15 minutes)

1. Create an ElevenLabs account (Creator plan or above for Professional Voice
   Cloning; Starter allows Instant Voice Cloning).
2. Voices, Add voice, Instant (or Professional) Voice Clone. Upload clean
   recordings of **Alpha himself** reading, at least one minute, ideally ten or
   more. The WhatsApp recording `AUD-20261010-WA0003.mp3` (about 5 MB) can be
   used if it is Alpha's own voice, with little background noise. ElevenLabs
   asks you to confirm you have the speaker's consent: only clone Alpha's voice
   with his permission.
3. Copy the **Voice ID** of the new voice, and an **API key** from your profile.
4. In Render, backend service, Environment, add `ELEVENLABS_API_KEY` and
   `ELEVENLABS_VOICE_ID`. Save; Render redeploys.
5. Dashboard, Essays: "Narrate in my voice" now appears beside each essay.

Cost is per character read. A 3,000 word essay is about 18,000 characters.

The code is deliberately written against a tiny interface, `speak`, `stop` and a
state callback, so that the real voice can be dropped in behind the same button
without touching anything that calls it.

## What reading in Alpha's own voice needs

Voice cloning is not something the site can do by itself. It needs a third party
model trained on a sample of Alpha's speech. The realistic options are
ElevenLabs, Resemble AI, or PlayHT. ElevenLabs is the usual choice for English
and gives the most natural result at this quality level.

**You need an account and an API key before any of this can be built.** I cannot
create one on your behalf, and there is no free path that produces a convincing
clone.

### How it would work

**Step 1, capture the sample.** The author records himself reading a script that
the site supplies. ElevenLabs needs a minimum of about one minute of clean audio
for an instant clone, and ten to thirty minutes for a high quality one. The
script matters: it should cover the full range of sounds in English, and be read
in the tone the books should be narrated in, not a performance.

A suggested script is at the bottom of this file.

**Step 2, create the voice.** The recording is uploaded to the provider, which
returns a voice id. That id is stored once, in Render's environment, not in the
database and never in the frontend.

**Step 3, generate audio per chapter.** Narration is generated **ahead of time**,
not on demand. Two reasons: it costs money per character, so generating the same
chapter for every reader would be wasteful; and generation takes seconds to
minutes, which is too slow to sit behind a button press.

The author would publish a chapter, press "Generate narration", and the backend
would send the text to the provider, receive the audio, and store it in the
private `audiobook` bucket that already exists. From there the existing
machinery takes over: purchase check, signed URL, expiring link. **No new
storage or delivery work is needed, because the audiobook pipeline is already
built.**

**Step 4, the same button.** The Listen control checks whether a generated
recording exists for the current chapter. If it does, it plays that. If not, it
falls back to the device voice as it does today.

### What it will cost

Roughly, at ElevenLabs pricing: a 60,000 word book is about 330,000 characters,
which is a mid tier monthly plan for a single book. Generate once, store the
file, serve it forever. Do not regenerate on each listen.

### The consent question

Alpha is cloning his own voice, so there is no consent problem here. But store
the voice id as a secret and do not expose any endpoint that lets an arbitrary
person synthesise speech with it. A cloned voice of a public figure who writes
about politics is worth misusing, and an open generation endpoint is how that
happens.

---

## Suggested recording script

Ask Alpha to read this aloud, once, in a quiet room, at his natural pace. No
performance, no projecting. The aim is the voice he would use reading to one
person across a table.

> My name is Alpha Amadu Jalloh. I write from Sierra Leone, about the questions
> many people are too careful to ask out loud.
>
> Questioning leadership is not an act of hostility. It is part of citizenship.
> A country that cannot bear to be asked a question is not yet at ease with
> itself.
>
> I have written about power, and about inequality, and about the ordinary
> dignity of people who are given very little and asked to be grateful for it.
> I have written about Freetown, about Nairobi, about the whole long argument
> between those who govern and those who are governed.
>
> Who prospers here? Who is left outside the circle? Why do we accept that the
> answer never seems to change?
>
> Some of these writings challenge authority. Others challenge society. Some
> challenge the reader. And sometimes, they challenge me.
>
> Zero, one, two, three, four, five, six, seven, eight, nine.
>
> Thank you for reading, and for listening.

That covers the vowel and consonant range, question intonation, list intonation,
numbers, and place names, which is what a clone needs to sound natural rather
than flat.

Record as WAV or high bitrate MP3. Phone microphones are acceptable if the room
is quiet. Avoid background music, fans and echo, which matter far more to the
result than the microphone does.
