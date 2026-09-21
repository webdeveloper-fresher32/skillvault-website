class Song {
    private final String title;

    public Song(String title) {
        this.title = title;
    }

    public String getTitle() {
        return this.title;
    }
}

class Node {
    Song song;
    Node next;

    public Node(Song song) {
        this.song = song;
        this.next = null;
    }
}

interface CustomIterator<T> {
    boolean hasNext();
    T next();
}

class LinkedListPlaylistIterator implements CustomIterator<Song> {
    private Node current;

    public LinkedListPlaylistIterator(Node head) {
        this.current = head;
    }

    @Override
    public boolean hasNext() {
        return this.current != null;
    }

    @Override
    public Song next() {
        if (this.hasNext()) {
            Song song = this.current.song;
            this.current = this.current.next;
            return song;
        }
        return null;
    }
}

class LinkedListPlaylist {
    private Node head = null;
    private Node tail = null;

    public void addSong(Song song) {
        Node newNode = new Node(song);
        if (this.head == null) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }
    }

    public CustomIterator<Song> createIterator() {
        return new LinkedListPlaylistIterator(this.head);
    }
}

public class LinkedListIteratorExample {
    public static void main(String[] args) {
        LinkedListPlaylist playlist = new LinkedListPlaylist();
        playlist.addSong(new Song("song1"));
        playlist.addSong(new Song("song2"));
        playlist.addSong(new Song("song3"));
        playlist.addSong(new Song("song4"));

        CustomIterator<Song> iterator = playlist.createIterator();

        System.out.println("Playing all songs:");
        while (iterator.hasNext()) {
            System.out.println(iterator.next().getTitle());
        }
    }
}
