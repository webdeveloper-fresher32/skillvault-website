public class GoodExample {
    static class Laptop {
        private String processor;
        private String ram;
        private String graphicCard;
        private String color;
        private String screenSize;

        public void displaySpecs() {
            if (this.processor != null) {
                System.out.println("processor = " + this.processor);
            }
            if (this.ram != null) {
                System.out.println("Ram = " + this.ram);
            }
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

    static class LaptopBuilder {
        private final Laptop laptop = new Laptop();

        public LaptopBuilder setProcessor(String processor) {
            this.laptop.processor = processor;
            return this;
        }

        public LaptopBuilder setRam(String ram) {
            this.laptop.ram = ram;
            return this;
        }

        public LaptopBuilder setGraphicCard(String graphicCard) {
            this.laptop.graphicCard = graphicCard;
            return this;
        }

        public LaptopBuilder setColor(String color) {
            this.laptop.color = color;
            return this;
        }

        public LaptopBuilder setScreenSize(String screenSize) {
            this.laptop.screenSize = screenSize;
            return this;
        }

        public Laptop build() {
            return this.laptop;
        }
    }

    public static void main(String[] args) {
        Laptop l = new LaptopBuilder()
            .setProcessor("i5-43423")
            .setRam("5")
            .setColor("black")
            .build();
        l.displaySpecs();
    }
}
