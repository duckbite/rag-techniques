import { describe, expect, it } from "vitest";
import { parseListingPage, extractHotelIdFromUrl } from "../parseListing";

const SAMPLE_LISTING_HTML = `
<html>
  <body>
    <li>
      <a href="/hotel/nl/sample-hotel.en-gb.html">Sample Hotel</a>
      <a href="/hotel/nl/sample-hotel.en-gb.html?map=1">Den Bosch · Show on map</a>
      <div>Scored 8.7</div>
      <div>1,234 reviews</div>
    </li>
    <a aria-label="Next page" href="/searchresults.html?ss=Den+Bosch&page=2">Next</a>
  </body>
</html>
`;

describe("parseListingPage", () => {
  it("parses hotels and next page URL from a listing page", () => {
    const result = parseListingPage(SAMPLE_LISTING_HTML, "Den Bosch", "Netherlands");

    expect(result.hotels).toHaveLength(1);
    const hotel = result.hotels[0];
    expect(hotel.hotelName).toBe("Sample Hotel");
    expect(hotel.hotelAddress).toContain("Den Bosch");
    expect(hotel.city).toBe("Den Bosch");
    expect(hotel.country).toBe("Netherlands");
    expect(hotel.hotelUrl).toContain("booking.com");
    expect(hotel.hotelRating).toBeCloseTo(8.7);
    expect(hotel.reviewCount).toBe(1234);

    expect(result.hotelUrls).toHaveLength(1);
    expect(result.nextPageUrl).toContain("page=2");
  });
});

describe("extractHotelIdFromUrl", () => {
  it("extracts stable id from hotel URL", () => {
    const id = extractHotelIdFromUrl(
      "https://www.booking.com/hotel/nl/sample-hotel.en-gb.html"
    );
    expect(id).toBe("sample-hotel.en-gb");
  });
});


