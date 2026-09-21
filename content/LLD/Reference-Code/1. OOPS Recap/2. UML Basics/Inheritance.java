public class Inheritance {
    // Parent class (Superclass)
    static class Animal {
        private String name;
        private int age;

        public Animal(String name, int age) {
            this.name = name;
            this.age = age;
        }

        public String getName() {
            return this.name;
        }

        public int getAge() {
            return this.age;
        }

        public void eat() {
            System.out.println(this.name + " is eating...");
        }

        public void sleep() {
            System.out.println(this.name + " is sleeping...");
        }
    }

    static class Dog extends Animal { // Dog IS-A Animal
        private String breed;

        public Dog(String name, int age, String breed) {
            super(name, age);
            this.breed = breed;
        }

        public String getBreed() {
            return this.breed;
        }

        public void bark() {
            System.out.println(this.getName() + " is barking: Bhow Bhow!");
        }

        public void playFetch() {
            System.out.println(this.getName() + " is playing fetch!");
        }
    }

    public static void main(String[] args) {
        Animal animal1 = new Animal("Generic Animal", 5);
        animal1.eat();
        animal1.sleep();

        System.out.println("\n" + "=".repeat(50) + "\n");

        Dog dog1 = new Dog("Tommy", 3, "Golden Retriever");
        dog1.eat();
        dog1.sleep();

        dog1.bark();
        dog1.playFetch();
    }
}
