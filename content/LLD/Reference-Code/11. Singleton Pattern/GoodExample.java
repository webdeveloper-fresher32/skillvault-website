public class GoodExample {
    public static class Logger {
        private static Logger instance;
        private final String fileName;
        private int logCount;

        private Logger(String fileName) {
            this.fileName = fileName;
            this.logCount = 0;
        }

        public static synchronized Logger getInstance(String fileName) {
            if (instance == null) {
                instance = new Logger(fileName);
            }
            return instance;
        }

        public void log(String msg) {
            System.out.println("Logging " + msg + " in " + this.fileName);
            this.logCount++;
        }

        public int getLogCount() {
            return this.logCount;
        }
    }

    public static void main(String[] args) {
        Logger log1 = Logger.getInstance("app.log");
        log1.log("Hey");

        Logger log2 = Logger.getInstance("app.log");
        log2.log("Bye");

        Logger log3 = Logger.getInstance("app.log");
        log3.log("Good");

        System.out.println(log1.getLogCount());
        System.out.println(log2.getLogCount());
        System.out.println(log3.getLogCount());
    }
}
