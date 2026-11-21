import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeekerAvatar } from "@/components/SeekerAvatar";

describe("SeekerAvatar", () => {
  it("shows the saved image URL as the profile portrait", () => {
    render(<SeekerAvatar imageUrl="https://images.example.test/avatar.png" alt="Reader portrait" />);

    expect(screen.getByRole("img", { name: "Reader portrait" })).toHaveAttribute(
      "src",
      "https://images.example.test/avatar.png",
    );
  });

  it("uses the selected profile style when no uploaded image exists", () => {
    render(<SeekerAvatar style="raven" alt="Reader portrait" />);

    expect(screen.getByLabelText("Reader portrait")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Reader portrait" })).not.toBeInTheDocument();
  });
});