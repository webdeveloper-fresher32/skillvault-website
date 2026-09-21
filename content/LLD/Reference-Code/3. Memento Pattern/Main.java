public class Main {
    public static void main(String[] args) {
        TextEditor textEditor = new TextEditor();
        History history = new History();

        textEditor.write("Hello");
        textEditor.write(" World");
        history.saveState(textEditor.save());
        textEditor.write(" Good");
        textEditor.write(" Bye");
        history.saveState(textEditor.save());
        System.out.println(textEditor.getText());
        System.out.println("-------");
        textEditor.restore(history.undo());
        System.out.println(textEditor.getText());
        textEditor.restore(history.undo());
        System.out.println(textEditor.getText());
    }
}
