import java.util.ArrayList;
import java.util.List;

public class GoodExample {
    interface Image {
        void display();
    }

    static class HighResImage implements Image {
        private final String fileName;
        private String imageData;

        public HighResImage(String fileName) {
            this.fileName = fileName;
            loadFromDisk();
        }

        private void loadFromDisk() {
            try {
                Thread.sleep(50); // Simulating disk load
            } catch (InterruptedException ignored) {}
            this.imageData = "[[Loaded image data of " + this.fileName + "]]";
            System.out.println("Loaded " + this.fileName + " from disk");
        }

        @Override
        public void display() {
            System.out.println(this.fileName + " has image data of " + this.imageData + "\n");
        }
    }

    static class ImageProxy implements Image {
        private final String fileName;
        private HighResImage realImage;

        public ImageProxy(String fileName) {
            this.fileName = fileName;
        }

        @Override
        public void display() {
            if (this.realImage == null) {
                this.realImage = new HighResImage(this.fileName);
            }
            this.realImage.display();
        }
    }

    static class PhotoGallery {
        private final List<ImageProxy> images = new ArrayList<>();

        public void addImage(String fileName) {
            ImageProxy imageProxy = new ImageProxy(fileName);
            this.images.add(imageProxy);
        }

        public void displayGallery() {
            for (ImageProxy image : this.images) {
                image.display();
            }
        }

        public void showImage(int index) {
            this.images.get(index - 1).display();
        }
    }

    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();
        PhotoGallery photoGallery = new PhotoGallery();
        photoGallery.addImage("image1.png");
        photoGallery.addImage("image2.png");
        photoGallery.addImage("image3.png");
        photoGallery.addImage("image4.png");
        long endTime = System.currentTimeMillis();
        System.out.printf("Gallery created instantly in: %.1fs%n", (endTime - startTime) / 1000.0);

        photoGallery.showImage(2);
        System.out.println("----------");
        photoGallery.showImage(2);
        System.out.println("----------");
        photoGallery.showImage(2);
        System.out.println("----------");
        photoGallery.showImage(2);
        System.out.println("----------");
    }
}
