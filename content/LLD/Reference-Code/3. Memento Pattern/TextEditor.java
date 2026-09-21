public class TextEditor {
    private String text = "";

    public void write(String newText) {
        this.text += newText;
    }

    public String getText() {
        return this.text;
    }

    public TextMemento save() {
        return new TextMemento(this.text);
    }

    public void restore(TextMemento tm) {
        this.text = (tm != null) ? tm.getSavedText() : "";
    }
}
