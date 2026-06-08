import { fireEvent, render } from "@testing-library/react-native";

import { defaultProfile } from "@/data/database";
import { ReadingForm } from "@/features/reading/reading-form";

describe("ReadingForm", () => {
  it("submits a valid manual reading with context", async () => {
    const onSubmit = jest.fn();
    const view = await render(<ReadingForm profile={defaultProfile} onSubmit={onSubmit} />);

    await fireEvent.changeText(view.getByLabelText("Glucose value"), "142");
    await fireEvent.changeText(view.getByPlaceholderText("Breakfast, dinner, late snack"), "breakfast");
    await fireEvent.press(view.getByText("after meal"));
    await fireEvent.press(view.getByText("walked"));
    await fireEvent.press(view.getByText("Save reading"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        displayValue: 142,
        displayUnit: "mg/dL",
        timing: "after_meal",
        mealLabel: "breakfast",
        tags: expect.arrayContaining(["walked"]),
      })
    );
  });

  it("does not submit implausible glucose values", async () => {
    const onSubmit = jest.fn();
    const view = await render(<ReadingForm profile={defaultProfile} onSubmit={onSubmit} />);

    await fireEvent.changeText(view.getByLabelText("Glucose value"), "900");
    await fireEvent.press(view.getByText("Save reading"));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
