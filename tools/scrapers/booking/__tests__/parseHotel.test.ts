import { describe, expect, it } from "vitest";
import { parseHotelDetailPage } from "../parseHotel";

const SAMPLE_HOTEL_HTML = `
<html>
  <body>
    <div data-testid="room-row">
      <span data-testid="room-name">Double Room with City View</span>
      <div data-testid="occupancy-information">Sleeps 2 adults</div>
      <div data-testid="price-and-discounted-price">€ 129</div>
      <div data-testid="policy-subtitle">
        Free cancellation • No prepayment needed
      </div>
      <div data-testid="mealplan-inclusive">Breakfast included</div>
      <ul data-testid="facilities">
        <li>Free WiFi</li>
        <li>Parking</li>
      </ul>
    </div>
  </body>
</html>
`;

describe("parseHotelDetailPage", () => {
  it("parses room details from hotel page HTML", () => {
    const rooms = parseHotelDetailPage(
      SAMPLE_HOTEL_HTML,
      "https://www.booking.com/hotel/nl/sample-hotel.en-gb.html"
    );

    expect(rooms).toHaveLength(1);
    const room = rooms[0];

    expect(room.hotelId).toBe("sample-hotel.en-gb");
    expect(room.roomName).toContain("City View");
    expect(room.maxOccupancy).toBe(2);
    expect(room.pricePerNight).toBeCloseTo(129);
    expect(room.currency).toBe("EUR");
    expect(room.freeCancellation).toBe(true);
    expect(room.noPrepaymentNeeded).toBe(true);
    expect(room.breakfastIncluded).toBe(true);
    expect(room.amenitiesSummary).toContain("Free WiFi");
  });
});


