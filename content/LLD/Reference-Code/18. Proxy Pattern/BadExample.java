import java.util.ArrayList;
import java.util.List;

public class BadExample {
    static class HighResImage {
        private final String fileName;
        private String imageData;

        public HighResImage(String fileName) {
            this.fileName = fileName;
            loadFromDisk();
        }

        private void loadFromDisk() {
            try {
                Thread.sleep(50); // Simulating expensive I/O
            } catch (InterruptedException ignored) {}
            this.imageData = "[[Loaded image data of " + this.fileName + "]]";
            System.out.println("Loaded " + this.fileName + " from disk");
        }

        public void display() {
            System.out.println(this.fileName + " has image data of " + this.imageData + "\n");
        }
    }

    static class PhotoGallery {
        private final List<HighResImage> images = new ArrayList<>();

        public void addImage(String fileName) {
            HighResImage highResImage = new HighResImage(fileName);
            this.images.add(highResImage);
        }

        public void displayGallery() {
            for (HighResImage image : this.images) {
                image.display();
            }
        }
    }

    public static void main(String[] args) {
        PhotoGallery photoGallery = new PhotoGallery();
        photoGallery.addImage("image1.png");
        photoGallery.addImage("image2.png");
        photoGallery.addImage("image3.png");
        photoGallery.addImage("image4.png");
    }
}
