import java.util.ArrayList;
import java.util.List;

public class GoodExample {
    interface FileSystemComponent {
        void showDetails();
    }

    static class File implements FileSystemComponent {
        private final String name;

        public File(String name) {
            this.name = name;
        }

        @Override
        public void showDetails() {
            System.out.println("File : " + this.name);
        }
    }

    static class Folder implements FileSystemComponent {
        private final String name;
        private final List<FileSystemComponent> components = new ArrayList<>();

        public Folder(String name) {
            this.name = name;
        }

        public void addComponent(FileSystemComponent component) {
            this.components.add(component);
        }

        @Override
        public void showDetails() {
            System.out.println("Folder name: " + this.name);
            for (FileSystemComponent component : this.components) {
                component.showDetails();
            }
        }
    }

    public static void main(String[] args) {
        File file1 = new File("image.png");
        File file2 = new File("ppt");
        File file3 = new File("word.exe");

        Folder subFolder = new Folder("sub folder");
        subFolder.addComponent(file1);
        subFolder.addComponent(file2);
        subFolder.addComponent(file3);

        File imageFile = new File("imaaageeee");
        File movie = new File("krissh");
        Folder mainFolder = new Folder("main folder");
        mainFolder.addComponent(imageFile);
        mainFolder.addComponent(movie);
        mainFolder.addComponent(subFolder);

        mainFolder.showDetails();
    }
}
