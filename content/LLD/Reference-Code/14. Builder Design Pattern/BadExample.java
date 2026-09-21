public class BadExample {
    static class Laptop {
        private String processor;
        private String ram;
        private String graphicCard;
        private String color;
        private String screenSize;

        public Laptop(String processor, String ram, String graphicCard, String color, String screenSize) {
            this.processor = processor;
            this.ram = ram;
            this.graphicCard = graphicCard;
            this.color = color;
            this.screenSize = screenSize;
        }

        public Laptop(String processor, String ram) {
            this(processor, ram, null, null, null);
        }

        public void displaySpecs() {
            System.out.println("Processor = " + this.processor);
            System.out.println("Ram = " + this.ram + "GB");
            if (this.graphicCard != null) {
                System.out.println("Graphic Card = " + this.graphicCard);
            }
            if (this.color != null) {
                System.out.println("Color = " + this.color);
            }
            if (this.screenSize != null) {
                System.out.println("Screen Size = " + this.screenSize);
            }
        }
    }

    public static void main(String[] args) {
        Laptop laptop1 = new Laptop("i5-3232", "6");
        laptop1.displaySpecs();

        Laptop laptop2 = new Laptop("i5-3232", "6", null, "Black", null);
        laptop2.displaySpecs();
    }
}
