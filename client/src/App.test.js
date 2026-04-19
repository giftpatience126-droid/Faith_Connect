import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders faith connect heading", () => {
  render(<App />);
  expect(screen.getByText(/Faith Connect/i)).toBeInTheDocument();
});
