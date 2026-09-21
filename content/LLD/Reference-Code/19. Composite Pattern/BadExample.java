import java.util.ArrayList;
import java.util.List;

public class BadExample {
    static class File {
        private final String name;

        public File(String name) {
            this.name = name;
        }

        public String showDetails() {
            return "File : " + this.name;
        }
    }

    // Flawed: Folder cannot contain subfolders, only files
    static class Folder {
        private final String name;
        private final List<File> files = new ArrayList<>();

        public Folder(String name) {
            this.name = name;
        }

        public void addFile(File file) {
            this.files.add(file);
        }

        public void showDetails() {
            System.out.println("Folder name: " + this.name);
            for (File file : this.files) {
                System.out.println(file.showDetails());
            }
        }
    }

    public static void main(String[] args) {
        File file1 = new File("image.png");
        File file2 = new File("ppt");
        File file3 = new File("word.exe");

        Folder folder = new Folder("my_drive");
        folder.addFile(file1);
        folder.addFile(file2);
        folder.addFile(file3);

        folder.showDetails();
    }
}
