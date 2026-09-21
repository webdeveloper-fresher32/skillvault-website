abstract class DataParser {
    public final void parse() {
        open();
        dataParser();
        close();
    }

    protected void open() {
        System.out.println("Opening the file");
    }

    protected void close() {
        System.out.println("Closing the file");
    }

    protected abstract void dataParser();
}

class CSVParser extends DataParser {
    @Override
    protected void dataParser() {
        System.out.println("Parsing CSV File");
    }
}

public class TemplatePatternExample {
    public static void main(String[] args) {
        CSVParser csvParser = new CSVParser();
        csvParser.parse();
    }
}
