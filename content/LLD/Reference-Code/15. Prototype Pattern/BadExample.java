import java.util.ArrayList;
import java.util.List;

public class BadExample {
    static class ChessPiece {
        private String name;
        private String position;
        private String color;

        public ChessPiece(String name, String position, String color) {
            this.name = name;
            this.position = position;
            this.color = color;
        }

        public String display() {
            return this.color + " " + this.name + " is at " + this.position;
        }
    }

    static class ChessBoard {
        public List<ChessPiece> pieces = new ArrayList<>();

        public void addPiece(ChessPiece piece) {
            this.pieces.add(piece);
        }

        public void displayBoard() {
            System.out.println("\nBoard State");
            for (ChessPiece piece : this.pieces) {
                System.out.println("   " + piece.display());
            }
        }
    }

    public static void main(String[] args) {
        ChessPiece piece1 = new ChessPiece("King", "e2", "Black");
        ChessPiece piece2 = new ChessPiece("Queen", "a1", "Black");
        ChessPiece piece3 = new ChessPiece("King", "c3", "White");
        ChessPiece piece4 = new ChessPiece("Queen", "d2", "White");

        ChessBoard chessBoard = new ChessBoard();
        chessBoard.addPiece(piece1);
        chessBoard.addPiece(piece2);
        chessBoard.addPiece(piece3);
        chessBoard.addPiece(piece4);

        chessBoard.displayBoard();

        // Bad: manual shallow copy of piece references
        ChessBoard newChessBoard = new ChessBoard();
        for (ChessPiece p : chessBoard.pieces) {
            newChessBoard.addPiece(p);
        }

        System.out.println("------------");
        newChessBoard.displayBoard();
    }
}
