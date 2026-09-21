public class BadExample {
    interface Employee {
        void eat();
        void work();
    }

    static class Worker implements Employee {
        @Override
        public void eat() {
            System.out.println("Worker is eating");
        }

        @Override
        public void work() {
            System.out.println("Worker is working");
        }
    }

    static class Robot implements Employee {
        @Override
        public void work() {
            System.out.println("Robot is working");
        }

        @Override
        public void eat() {
            throw new UnsupportedOperationException("Robot cant eat");
        }
    }

    public static void main(String[] args) {
        Robot r = new Robot();
        try {
            r.eat();
        } catch (UnsupportedOperationException e) {
            System.out.println("Exception: " + e.getMessage());
        }
    }
}
