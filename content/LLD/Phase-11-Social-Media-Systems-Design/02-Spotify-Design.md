# Spotify Design — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Class Diagram](#7-class-diagram)
8. [Python Implementation](#8-python-implementation)
9. [Key Decisions](#9-key-decisions)
10. [Step 7: Extensibility](#10-step-7-extensibility)
11. [Interview Follow-ups](#11-interview-follow-ups)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements

- Users can browse songs, albums, and artists, and search by title/artist.
- Users can create, rename, and delete their own playlists, and add/remove songs from them.
- Users can play, pause, skip, and queue up songs.
- A "play queue" holds upcoming songs distinct from any saved playlist.
- Playing an album or playlist should play its songs in order, and support shuffle/repeat later.

### Non-Functional Requirements (state these out loud)

- The player has a small set of well-defined states (`Playing`, `Paused`, `Stopped`) and the *set of valid actions changes depending on which state it's in* — pausing while already paused should be a no-op, not an error.
- Traversal over a playlist (or an album, or a queue) should be **uniform** — the code that "plays the next song" shouldn't need to know whether it's iterating a `Playlist`, an `Album`, or the `PlayQueue`.
- Out of scope: actual audio streaming/codec, licensing/rights, recommendation algorithms — mention these as "separate systems" if asked.

### Assumptions to state

- One `Player` instance is scoped to one user session, holding one `PlayQueue` at a time.
- A `Playlist` stores *references* to `Song`s (many playlists can include the same song) — it doesn't own the songs.

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|---|---|---|
| `Artist` | Core entity | Name, id |
| `Song` | Core entity | Title, duration, artist reference, album reference |
| `Album` | Core entity | Title, artist, ordered collection of songs |
| `Playlist` | Core entity | User-owned, ordered/mutable collection of song references |
| `User` | Core entity | Identity + owns playlists |
| `PlayQueue` | Collection | Ordered list of songs queued to play next |
| `PlayerState` | Interface (State pattern) | `Playing`, `Paused`, `Stopped` — defines allowed transitions |
| `Player` | Orchestrator | Holds current state + queue; exposes `play()`, `pause()`, `next()` |
| `SongIterator` | Interface (Iterator pattern) | Uniform traversal over any "collection of songs" |
| `MusicLibrary` | Orchestrator | Search/browse songs, albums, artists |

---

## 3. Step 3: Define Relationships

```
Artist       "performs"          Song, Album      1 -------- N
Album        "contains"          Song             1 -------- N   (composition — album owns track list order)
Playlist     "references"        Song             N -------- N   (association — many playlists share songs)
User         "owns"              Playlist         1 -------- N   (composition)
Player       "has current state" PlayerState      1 -------- 1   (State pattern, swappable)
Player       "plays from"        PlayQueue        1 -------- 1
PlayQueue    "traversed by"      SongIterator     (Iterator pattern)
Playlist     "traversed by"      SongIterator     (same interface, different concrete iterator)
```

- `Playlist`, `Album`, and `PlayQueue` are all, conceptually, "iterable collections of songs" — they implement a common `Iterable[Song]` contract so the `Player` can traverse any of them the same way.
- `PlayerState` implementations don't hold data themselves; they hold *behavior* for the `Player` they're attached to (classic State pattern).

---

## 4. Step 4: Assign Responsibilities

- **`Song` / `Album` / `Artist`** — pure data entities with metadata; no playback logic.
- **`Playlist`** — owns its ordered list of song references and exposes `add_song()` / `remove_song()` / `__iter__`. Does not know about the `Player`.
- **`PlayQueue`** — owns the "what plays next" ordering; supports `enqueue()`, `dequeue()`, and iteration. Distinct from `Playlist` because a queue is transient/session-scoped while a playlist is persistent.
- **`Player`** — owns the *current playback state* and delegates all state-dependent behavior (`play`, `pause`, `stop`, `next`) to its current `PlayerState` object. `Player` itself contains no `if state == ...` branching.
- **`PlayerState` subclasses** (`PlayingState`, `PausedState`, `StoppedState`) — each knows exactly which transitions are legal from itself, and performs the transition by calling back into `Player.set_state()`.
- **`MusicLibrary`** — owns search/browse; decoupled entirely from playback.

---

## 5. Step 5: Apply SOLID

| Principle | Application |
|---|---|
| **SRP** | `Player` manages playback orchestration only; `PlayerState` subclasses own transition rules; `Playlist`/`PlayQueue` own song collections; `MusicLibrary` owns search. |
| **OCP** | Adding a new state (e.g., `BufferingState` for network stalls) means adding a new `PlayerState` subclass — `Player`'s core code doesn't change. Adding a new "song collection" (e.g., `RadioStation`) means implementing the iterable contract — the `Player`'s traversal code doesn't change. |
| **LSP** | Any `PlayerState` can be swapped into `Player.state` — all honor `play()/pause()/stop()/next()` with the same signatures (some are no-ops, but never crash or violate the contract). Any `Iterable[Song]` (`Playlist`, `Album`, `PlayQueue`) can be handed to the player's "play this collection" method interchangeably. |
| **ISP** | `PlayerState` exposes only playback-transition methods; it isn't forced to implement search or library methods. `SongIterator` exposes only `has_next()`/`next()`. |
| **DIP** | `Player` depends on the abstract `PlayerState` interface, not concrete state classes. `Player.play_collection()` depends on `Iterable[Song]`, not on `Playlist` specifically. |

---

## 6. Step 6: Apply Design Patterns

### State Pattern — Player Lifecycle

**Problem it solves:** the player's behavior for `play()`/`pause()`/`next()` genuinely differs depending on whether it's currently playing, paused, or stopped — e.g., calling `pause()` while `Stopped` should do nothing, but calling `pause()` while `Playing` should transition to `Paused`. Encoding this with `if self.status == "playing": ... elif self.status == "paused": ...` scattered across every method becomes an unmaintainable branching mess as more states are added (e.g., `Buffering`).

**Solution:** each state is its own class implementing the same interface. `Player` holds a reference to its *current* `PlayerState` object and simply delegates: `self.state.pause(self)`. The state object itself decides what happens and calls `player.set_state(NewState())` to transition. Adding a new state means adding a new class — zero changes to existing states or to `Player`.

### Iterator Pattern — Playlist/Album/Queue Traversal

**Problem it solves:** `Playlist`, `Album`, and `PlayQueue` are all "collections of songs," but they're structurally different classes with different internal storage. Code that plays "the next song" shouldn't need a different code path per collection type.

**Solution:** each collection implements Python's standard iterator protocol (`__iter__`/`__next__`), so the `Player` (or a custom `SongIterator`) can traverse any of them with the exact same `for song in collection:` loop, regardless of internal representation.

---

## 7. Class Diagram

```
┌────────────┐   1        N  ┌────────────┐   1        N  ┌────────────┐
│   Artist    │──performs────▶│    Song     │◀───contains───│    Album    │
└────────────┘                └────────────┘                └────────────┘
                                     ▲
                                     │ references (N:N)
                              ┌──────┴───────┐
                              │   Playlist    │  ── owned by ──▶ User
                              │───────────────│
                              │ -songs: List  │
                              │ +add_song()   │
                              │ +remove_song()│
                              │ +__iter__()   │
                              └───────────────┘

┌──────────────────────────┐
│      PlayerState (ABC)    │
│────────────────────────── │
│ +play(player)              │
│ +pause(player)              │
│ +stop(player)               │
│ +next(player)               │
└─────────────▲──────────────┘
              │ implements
   ┌──────────┼───────────────┐
┌──────────┐ ┌───────────┐ ┌───────────┐
│PlayingState│ │PausedState│ │StoppedState│
└──────────┘ └───────────┘ └───────────┘

┌────────────────────────────────────┐
│               Player                │
│──────────────────────────────────── │
│ -state: PlayerState  (current state)│
│ -queue: PlayQueue                    │
│ -current_song: Optional[Song]        │
│──────────────────────────────────── │
│ +play() / +pause() / +stop()         │
│ +next()                              │
│ +play_collection(Iterable[Song])     │
│ +set_state(new_state)                │
└──────────────────────────────────────┘
                 │ 1
                 ▼ 1
        ┌─────────────────┐
        │    PlayQueue      │
        │───────────────── │
        │ -songs: deque     │
        │ +enqueue()        │
        │ +dequeue()        │
        │ +__iter__()       │
        └───────────────────┘

┌───────────────────────┐
│      MusicLibrary        │
│───────────────────────  │
│ +search(query)           │
│ +browse_albums()         │
│ +browse_artists()        │
└───────────────────────────┘
```

---

## 8. Java Implementation

```java
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

public class Artist {
    private final String artistId;
    private final String name;

    public Artist(String name) {
        this.artistId = UUID.randomUUID().toString();
        this.name = name;
    }

    public String getArtistId() { return artistId; }
    public String getName() { return name; }

    @Override
    public String toString() {
        return name;
    }
}

public class Song {
    private final String songId;
    private final String title;
    private final Artist artist;
    private final int durationSec;

    public Song(String title, Artist artist, int durationSec) {
        this.songId = UUID.randomUUID().toString();
        this.title = title;
        this.artist = artist;
        this.durationSec = durationSec;
    }

    public String getSongId() { return songId; }
    public String getTitle() { return title; }
    public Artist getArtist() { return artist; }
    public int getDurationSec() { return durationSec; }

    @Override
    public String toString() {
        return title + " - " + artist.getName();
    }
}

public class Album implements Iterable<Song> {
    private final String title;
    private final Artist artist;
    private final List<Song> songs; // order matters — track list

    public Album(String title, Artist artist, List<Song> songs) {
        this.title = title;
        this.artist = artist;
        this.songs = new ArrayList<>(songs);
    }

    public String getTitle() { return title; }
    public Artist getArtist() { return artist; }
    public List<Song> getSongs() { return Collections.unmodifiableList(songs); }

    @Override
    public Iterator<Song> iterator() {
        return songs.iterator();
    }
}

/** References songs; does not own them. Multiple playlists can share a song. */
public class Playlist implements Iterable<Song> {
    private final String name;
    private final User owner;
    private final List<Song> songs = new CopyOnWriteArrayList<>();

    public Playlist(String name, User owner) {
        this.name = name;
        this.owner = owner;
    }

    public void addSong(Song song) {
        songs.add(song);
    }

    public void removeSong(Song song) {
        songs.remove(song);
    }

    public String getName() { return name; }
    public User getOwner() { return owner; }
    public List<Song> getSongs() { return Collections.unmodifiableList(songs); }

    @Override
    public Iterator<Song> iterator() {
        return songs.iterator();
    }
}

public class User {
    private final String userId;
    private final String name;
    private final List<Playlist> playlists = new CopyOnWriteArrayList<>();

    public User(String name) {
        this.userId = UUID.randomUUID().toString();
        this.name = name;
    }

    public Playlist createPlaylist(String name) {
        Playlist playlist = new Playlist(name, this);
        playlists.add(playlist);
        return playlist;
    }

    public String getUserId() { return userId; }
    public String getName() { return name; }
    public List<Playlist> getPlaylists() { return Collections.unmodifiableList(playlists); }
}

/** Transient, session-scoped "play next" ordering — distinct from a saved Playlist. */
public class PlayQueue implements Iterable<Song> {
    private final Deque<Song> songs = new ArrayDeque<>();

    public synchronized void enqueue(Song song) {
        songs.addLast(song);
    }

    public synchronized void enqueueAll(Iterable<Song> incoming) {
        for (Song s : incoming) {
            songs.addLast(s);
        }
    }

    public synchronized Optional<Song> dequeue() {
        return songs.isEmpty() ? Optional.empty() : Optional.of(songs.removeFirst());
    }

    public synchronized boolean isEmpty() {
        return songs.isEmpty();
    }

    public synchronized int size() {
        return songs.size();
    }

    @Override
    public synchronized Iterator<Song> iterator() {
        return new ArrayList<>(songs).iterator();
    }
}

// ---- State pattern ----
public interface PlayerState {
    void play(Player player);
    void pause(Player player);
    void stop(Player player);
}

public class StoppedState implements PlayerState {
    @Override
    public void play(Player player) {
        Optional<Song> songOpt = player.getQueue().dequeue();
        if (songOpt.isPresent()) {
            Song song = songOpt.get();
            player.setCurrentSong(song);
            player.setState(new PlayingState());
            System.out.println("Now playing: " + song);
        }
    }

    @Override
    public void pause(Player player) {
        // no-op: nothing is playing
    }

    @Override
    public void stop(Player player) {
        // already stopped
    }
}

public class PlayingState implements PlayerState {
    @Override
    public void play(Player player) {
        // already playing
    }

    @Override
    public void pause(Player player) {
        player.setState(new PausedState());
        System.out.println("Paused: " + player.getCurrentSong());
    }

    @Override
    public void stop(Player player) {
        player.setCurrentSong(null);
        player.setState(new StoppedState());
        System.out.println("Stopped");
    }
}

public class PausedState implements PlayerState {
    @Override
    public void play(Player player) {
        player.setState(new PlayingState());
        System.out.println("Resumed: " + player.getCurrentSong());
    }

    @Override
    public void pause(Player player) {
        // already paused
    }

    @Override
    public void stop(Player player) {
        player.setCurrentSong(null);
        player.setState(new StoppedState());
        System.out.println("Stopped");
    }
}

public class Player {
    private PlayerState state = new StoppedState();
    private final PlayQueue queue = new PlayQueue();
    private Song currentSong;

    public synchronized void setState(PlayerState state) {
        this.state = state;
    }

    public synchronized void play() {
        state.play(this);
    }

    public synchronized void pause() {
        state.pause(this);
    }

    public synchronized void stop() {
        state.stop(this);
    }

    /** Works whether currently playing or paused — always advances the queue. */
    public synchronized void next() {
        this.currentSong = null;
        setState(new StoppedState());
        play();
    }

    /**
     * Uniform entry point — works for Playlist, Album, or another PlayQueue
     * because all three implement Iterable<Song>.
     */
    public synchronized void playCollection(Iterable<Song> collection) {
        queue.enqueueAll(collection);
        play();
    }

    public PlayerState getState() { return state; }
    public PlayQueue getQueue() { return queue; }
    public Song getCurrentSong() { return currentSong; }
    public void setCurrentSong(Song currentSong) { this.currentSong = currentSong; }
}

public class MusicLibrary {
    private final List<Song> songs = new CopyOnWriteArrayList<>();
    private final List<Album> albums = new CopyOnWriteArrayList<>();
    private final List<Artist> artists = new CopyOnWriteArrayList<>();

    public void addAlbum(Album album) {
        albums.add(album);
        for (Song s : album) {
            songs.add(s);
        }
        if (!artists.contains(album.getArtist())) {
            artists.add(album.getArtist());
        }
    }

    public List<Song> search(String query) {
        String q = query.toLowerCase();
        return songs.stream()
            .filter(s -> s.getTitle().toLowerCase().contains(q) || s.getArtist().getName().toLowerCase().contains(q))
            .collect(Collectors.toList());
    }

    public List<Song> getSongs() { return Collections.unmodifiableList(songs); }
    public List<Album> getAlbums() { return Collections.unmodifiableList(albums); }
    public List<Artist> getArtists() { return Collections.unmodifiableList(artists); }
}
```

---

## 9. Key Decisions

**State pattern instead of an enum + if/elif in `Player`.** A naive design gives `Player` a `status: str` field and checks it in every method (`if self.status == "playing": ...`). This scales badly the moment a `BufferingState` or `AdPlayingState` is introduced — every method grows another branch. Modeling each state as its own class means each state file only contains logic relevant to *itself*, and `Player`'s core methods (`play`, `pause`, `stop`) never change when a new state is added — pure OCP.

**`PlayQueue` is separate from `Playlist`.** These look similar (both hold `Song`s) but serve different purposes: a `Playlist` is a **persistent, user-curated** collection; a `PlayQueue` is a **transient, session-scoped** "what's coming up next," rebuilt every time playback starts. Merging them into one class would conflate "save this list forever" with "play these songs right now," which breaks the moment a user wants to queue an ad-hoc song without polluting a saved playlist.

**Iterator/uniform traversal via a shared protocol.** Rather than giving `Player.play_collection()` three overloads (one per `Playlist`, `Album`, `PlayQueue`), each collection implements the same `__iter__` contract. `Player` codes against "any iterable of Song" — a new collection type (e.g., `RadioStation`, `DailyMix`) needs zero changes to `Player` as long as it implements `__iter__`.

**`Playlist` stores references, not owned copies, of `Song`.** Since the same song can appear in many playlists and the album it originally came from, `Playlist` must never duplicate or own `Song` objects — it holds references into the shared `MusicLibrary` catalog. This avoids data duplication and keeps song metadata edits (e.g., correcting a title) visible everywhere.

---

## 10. Step 7: Extensibility

- **Shuffle/Repeat modes:** introduce a `PlayQueue` traversal strategy (Strategy pattern) — `SequentialOrder` vs `ShuffleOrder` — swapped at runtime without touching `Player` or `PlayerState`.
- **Buffering state (network stalls):** add `BufferingState(PlayerState)`; `Player`'s existing `play()/pause()/stop()` calls need zero changes since they already delegate to `self.state`.
- **Podcasts / audiobooks (resumable position):** add a `progress_sec` field to `Song`'s play-session tracking, or introduce a `Playable` interface that both `Song` and `PodcastEpisode` implement — `Player` depends on `Playable`, not concretely on `Song`.
- **Collaborative playlists (multiple owners can edit):** change `Playlist.owner: User` to `Playlist.collaborators: List[User]` and add a permission check in `add_song()`/`remove_song()` — no change needed to `Player`, `PlayQueue`, or `MusicLibrary`.

---

## 11. Interview Follow-ups

- "How would you implement shuffle without losing the ability to 'un-shuffle'?" — Discuss keeping the original order list intact and generating a separate shuffled index/order on top of it (Strategy pattern for ordering), rather than mutating the underlying list in place.
- "How do you handle offline downloaded songs vs. streamed songs?" — Suggest a `Playable` abstraction with `LocalSong` and `StreamedSong` implementations, both satisfying the same interface `Player` depends on.
- "How would cross-device playback sync work (start on phone, continue on laptop)?" — Mention that `Player` state (current song, position, queue) would need to be externalized to a shared session store rather than held only in-process — a hint that this in-memory model is for a single device/session.
- "How do you prevent two threads from calling `play()`and `pause()` on the same `Player` concurrently?" — Discuss guarding `set_state()` with a lock, since the State pattern's transitions must be atomic to avoid corrupted state.

---

## 12. Interview Q&A

**Q: Why use the State pattern for the player instead of a status flag with if/else branches?**
Answer: The player's valid actions genuinely change per state — pausing while stopped is a no-op, pausing while playing transitions to paused. An if/else-based design puts all this branching logic inside every method of `Player`, and every new state (buffering, ad-playing) adds another branch everywhere. The State pattern isolates each state's rules into its own class; `Player` just delegates to `self.state`, so adding a state means adding one new class with zero changes to existing code — satisfying the Open/Closed Principle.

**Q: Why is `PlayQueue` a separate class from `Playlist` instead of reusing `Playlist` for both?**
Answer: They represent different lifetimes and intents. A `Playlist` is persistent and user-curated — it survives across sessions and is explicitly saved. A `PlayQueue` is transient — it's the current session's "play next" list, rebuilt each time playback starts and often populated from a playlist, an album, or ad-hoc song additions. Conflating them would mean every temporary queue change risks mutating a saved playlist.

**Q: How does the Iterator pattern let `Player` treat a `Playlist`, `Album`, and `PlayQueue` uniformly?**
Answer: All three implement the standard iteration protocol (`__iter__` over `Song`), so `Player.play_collection()` can accept any of them as `Iterable[Song]` without knowing or caring about their internal storage — a `Playlist` stores a `List[Song]`, `PlayQueue` uses a `deque`, but the consuming code is identical either way.

**Q: How would you add a "radio station" that generates songs algorithmically instead of from a fixed list?**
Answer: Implement a `RadioStation` class with its own `__iter__` that lazily generates/fetches the next recommended song on each iteration, rather than holding a fixed list up front. Because `Player.play_collection()` only depends on the `Iterable[Song]` contract, it works with `RadioStation` with no modification — this demonstrates the value of coding to an interface (Iterator) rather than a concrete collection type.

**Q: Why does `Playlist` store references to `Song` objects rather than copies?**
Answer: The same song can legitimately belong to a user's playlist, the original album it came from, and someone else's playlist simultaneously. Storing references (not copies) into a shared `MusicLibrary` catalog avoids duplicating metadata and ensures a single correction (e.g., fixing a song title) is visible everywhere it's referenced.

**Q: What's the risk of putting playback logic directly inside `Song` or `Playlist` instead of a separate `Player`?**
Answer: `Song` and `Playlist` would then mix data-modeling concerns (title, duration, ordering) with stateful playback concerns (what's currently playing, paused, queued) — violating SRP. It would also make it impossible to have the same song playing independently across two different user sessions, since playback state would be tied to the data object rather than to a per-session `Player`.
