// Edit these to change what clients can book.
export const SERVICES = {
  consultation: "Style Consultation",
  audit: "Closet Audit",
  shopping: "Curated Shopping",
  resale: "Resale & Donation",
  meet: "Meet & Greet",
};

// Whole-dollar prices for services that are paid up front. Others are free to book.
export const PRICES = { meet: 5 };
export const VENMO_USER = "Kelly-Mushonga";

// Bookable start times (24h, local time zone). One booking per time by default;
// change the limit in the admin page.
export const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export const DEFAULT_CAPACITY = 1;
export const TIME_ZONE = "America/New_York";
export const STATUSES = ["pending", "confirmed", "declined", "cancelled"];
