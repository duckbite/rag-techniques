import { describe, expect, it } from "vitest";
import { parseListingPage, extractHotelIdFromUrl } from "../parseListing";

const SAMPLE_LISTING_HTML = `
<html>
  <body>
    <div data-testid="property-card">
      <a data-testid="title-link" href="/hotel/nl/sample-hotel.en-gb.html">
        <span data-testid="title">Sample Hotel</span>
      </a>
      <span data-testid="address">Main Street 1, Den Bosch</span>
      <div data-testid="review-score">
        <span>8.7</span>
        <span>1,234 reviews</span>
      </div>
    </div>
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


