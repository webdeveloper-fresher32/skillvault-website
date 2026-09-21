public class GoodExample {
    interface Workable {
        void work();
    }

    interface Eatable {
        void eat();
    }

    static class Robot implements Workable {
        @Override
        public void work() {
            System.out.println("Robot is working");
        }
    }

    static class Employee implements Workable, Eatable {
        @Override
        public void eat() {
            System.out.println("Employee is eating");
        }

        @Override
        public void work() {
            System.out.println("Employee is working");
        }
    }

    public static void main(String[] args) {
        Employee e = new Employee();
        e.eat();
        e.work();
    }
}
