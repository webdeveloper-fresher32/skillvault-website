import java.util.ArrayList;
import java.util.List;

public class History {
    private final List<TextMemento> history = new ArrayList<>();

    public void saveState(TextMemento tm) {
        this.history.add(tm);
    }

    public TextMemento undo() {
        if (!this.history.isEmpty()) {
            this.history.remove(this.history.size() - 1);
            if (this.history.isEmpty()) {
                return new TextMemento("");
            }
            return this.history.get(this.history.size() - 1);
        } else {
            return new TextMemento("");
        }
    }

    public void getHistory() {
        for (int i = 0; i < this.history.size(); i++) {
            System.out.println(i + " = " + this.history.get(i).getSavedText());
        }
    }
}
