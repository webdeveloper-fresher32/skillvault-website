class Animal {
    protected String name;
    protected int age;

    public Animal(String name, int age) {
        System.out.println("Animal INIT");
        this.name = name;
        this.age = age;
    }

    public void eat() {
        System.out.println("I am eating");
    }

    public void sleep() {
        System.out.println("I am sleeping");
    }

    public void move() {
        System.out.println("I am moving");
    }
}

class Dog extends Animal {
    private String breed;

    public Dog(String name, int age, String breed) {
        super(name, age);
        this.breed = breed;
    }

    public void bark() {
        System.out.println("I am barking");
    }

    public void display() {
        System.out.println("Name is " + this.name + " and age is " + this.age);
    }

    @Override
    public void move() {
        System.out.println("I am running on 4 legs");
    }
}

public class Inheritance {
    public static void main(String[] args) {
        Dog dog = new Dog("Cheery", 5, "Indie");
        dog.move();
    }
}
