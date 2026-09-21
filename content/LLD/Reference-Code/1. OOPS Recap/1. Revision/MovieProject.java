/**
 * Create a class Movie with the following:
 *
 * Attributes:
 * movieName  -> name of the movie
 * totalSeats -> total seats available in the theatre
 * ticketPrice -> price per ticket
 * bookedSeats -> starts at 0
 *
 * Methods:
 * bookTickets(numOfTickets) -> books the given number of tickets. If enough seats are available,
 * confirm the booking and show the total amount to pay. If not,
 * show "Sorry, not enough seats available"
 *
 * showStatus() -> displays movie name, seats available, and seats booked so far
 */
class Movie {
    private String movieName;
    private int totalSeats;
    private int ticketPrice;
    private int bookedSeats;

    public Movie(String movieName, int totalSeats, int ticketPrice) {
        this.movieName = movieName;
        this.totalSeats = totalSeats;
        this.ticketPrice = ticketPrice;
        this.bookedSeats = 0;
    }

    public void bookTickets(int numOfTickets) {
        if (numOfTickets > this.totalSeats - this.bookedSeats) {
            System.out.println("Sorry, not enough seats available");
        } else {
            this.bookedSeats += numOfTickets;
            this.totalSeats -= numOfTickets;
            System.out.println("Your ticket is booked");
            System.out.println("Total price = " + (this.ticketPrice * numOfTickets) + "\n");
        }
    }

    public void showStatus() {
        System.out.println("Movie name = " + this.movieName);
        System.out.println("Seats available = " + this.totalSeats);
        System.out.println("Total booked = " + this.bookedSeats + "\n");
    }
}

public class MovieProject {
    public static void main(String[] args) {
        Movie movie = new Movie("Krish", 100, 499);
        movie.showStatus();
        movie.bookTickets(70);
        movie.showStatus();
        movie.bookTickets(70);
    }
}
