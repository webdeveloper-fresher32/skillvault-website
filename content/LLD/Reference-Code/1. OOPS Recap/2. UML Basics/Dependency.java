public class Dependency {
    static class Document {
        private String title;
        private String content;
        private int pages;

        public Document(String title, String content, int pages) {
            this.title = title;
            this.content = content;
            this.pages = pages;
        }

        public String getTitle() {
            return this.title;
        }

        public String getContent() {
            return this.content;
        }

        public int getPages() {
            return this.pages;
        }
    }

    // Printer class (depends on Document)
    static class Printer {
        private String printerName;
        private String printerType;

        public Printer(String printerName, String printerType) {
            this.printerName = printerName;
            this.printerType = printerType;
        }

        public void printDocument(Document document) {
            System.out.println("\n" + "=".repeat(50));
            System.out.println("Printer: " + this.printerName + " (" + this.printerType + ")");
            System.out.println("=".repeat(50));
            System.out.println("Printing Document: " + document.getTitle());
            System.out.println("Total Pages: " + document.getPages());
            System.out.println("\nContent:");
            System.out.println(document.getContent());
            System.out.println("=".repeat(50));
            System.out.println("✓ Printing completed!\n");
        }

        public String getPrinterInfo() {
            return this.printerName + " - " + this.printerType;
        }
    }

    public static void main(String[] args) {
        Document doc1 = new Document(
            "Java Tutorial",
            "This is a beginner guide to Java programming...",
            10
        );

        Document doc2 = new Document(
            "LLD Notes",
            "Low Level Design concepts and patterns...",
            25
        );

        Printer officePrinter = new Printer("HP LaserJet", "Laser Printer");

        officePrinter.printDocument(doc1);
        officePrinter.printDocument(doc2);

        System.out.println("Document 1 still exists: " + doc1.getTitle());
        System.out.println("Document 2 still exists: " + doc2.getTitle());
    }
}
