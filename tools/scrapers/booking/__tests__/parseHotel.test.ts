import { describe, expect, it } from "vitest";
import { parseHotelRoomsSnapshot } from "../parseHotel";

const SAMPLE_HOTEL_HTML = `
<html>
  <body>
    <table>
      <tr>
        <td class="hprt-roomtype-block hprt-roomtype-name">
          <a class="hprt-roomtype-icon-link">Double Room with City View</a>
        </td>
        <td>
          <span class="bui-u-sr-only">Max. people: 2</span>
          <div class="hprt-price-block">
            <span class="bui-price-display__value">€ 129</span>
            <span class="bui-price-display__original">€ 150</span>
          </div>
          <div class="hprt-facilities-block">
            <span class="hprt-facilities-facility"><span>Free WiFi</span></span>
            <span class="hprt-facilities-facility"><span>Parking</span></span>
          </div>
          <div class="hprt-conditions">Free cancellation</div>
          <div class="hprt-conditions-mealplan">Breakfast included</div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

describe("parseHotelRoomsSnapshot", () => {
  it("parses room details from hotel page HTML", () => {
    const rooms = parseHotelRoomsSnapshot(
      SAMPLE_HOTEL_HTML,
      "https://www.booking.com/hotel/nl/sample-hotel.en-gb.html"
    );

    expect(rooms).toHaveLength(1);
    const room = rooms[0];

    expect(room.hotelId).toBe("sample-hotel.en-gb");
    expect(room.roomName).toContain("City View");
    expect(room.maxOccupancy).toBe(2);
    expect(room.priceCurrent).toBeCloseTo(129);
    expect(room.priceOriginal).toBeCloseTo(150);
    expect(room.currency).toBe("EUR");
    expect(room.cancellationPolicy).toContain("Free cancellation");
    expect(room.mealPlan).toContain("Breakfast");
    expect(room.roomHighlights).toContain("Free WiFi");
  });
});
