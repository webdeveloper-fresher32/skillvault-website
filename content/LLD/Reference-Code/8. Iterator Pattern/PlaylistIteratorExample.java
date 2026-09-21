import java.util.ArrayList;
import java.util.List;

class Song {
    private final String title;

    public Song(String title) {
        this.title = title;
    }

    public String getTitle() {
        return this.title;
    }
}

interface CustomIterator<T> {
    boolean hasNext();
    T next();
}

class PlaylistIterator implements CustomIterator<Song> {
    private final List<Song> songList;
    private int position = 0;

    public PlaylistIterator(List<Song> songList) {
        this.songList = songList;
    }

    @Override
    public boolean hasNext() {
        return this.position < this.songList.size();
    }

    @Override
    public Song next() {
        if (this.hasNext()) {
            Song song = this.songList.get(this.position);
            this.position++;
            return song;
        }
        return null;
    }
}

class Playlist {
    private final List<Song> playlist = new ArrayList<>();

    public void addSong(Song song) {
        this.playlist.add(song);
    }

    public CustomIterator<Song> createIterator() {
        return new PlaylistIterator(this.playlist);
    }
}

public class PlaylistIteratorExample {
    public static void main(String[] args) {
        Playlist playlist = new Playlist();
        playlist.addSong(new Song("song1"));
        playlist.addSong(new Song("song2"));
        playlist.addSong(new Song("song3"));
        playlist.addSong(new Song("song4"));

        CustomIterator<Song> iterator = playlist.createIterator();

        while (iterator.hasNext()) {
            System.out.println(iterator.next().getTitle());
        }
    }
}
