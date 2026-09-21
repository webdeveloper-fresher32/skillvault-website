public class TextMemento {
    private final String savedText;

    public TextMemento(String text) {
        this.savedText = text;
    }

    public String getSavedText() {
        return this.savedText;
    }
}
