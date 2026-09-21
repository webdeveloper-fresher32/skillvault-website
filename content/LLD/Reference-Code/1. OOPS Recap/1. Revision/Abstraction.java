abstract class Shape {
    public abstract void area();
    public abstract void perimeter();
}

// Concrete Classes
class Rectangle extends Shape {
    private int length;
    private int breadth;

    public Rectangle(int length, int breadth) {
        this.length = length;
        this.breadth = breadth;
    }

    @Override
    public void area() {
        System.out.println(this.length * this.breadth);
    }

    @Override
    public void perimeter() {
        System.out.println(2 * (this.length + this.breadth));
    }
}

public class Abstraction {
    public static void main(String[] args) {
        Rectangle r = new Rectangle(5, 2);
        r.area();
        r.perimeter();
    }
}
