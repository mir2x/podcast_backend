import { Document, Schema, model } from "mongoose";

export type PlanDocument = Document & {
  name: string;
  description: string;
  unitAmount: number;
  interval: "month" | "year" | "all-time";
  productId: string;
  priceId: string;
};

const planSchema = new Schema<PlanDocument>({
  name: {
    type: String,
    required: true,
    default: "free",
  },
  description: {
    type: String,
    required: true,
  },
  unitAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  interval: {
    type: String,
    required: true,
    enum: ["month", "year", "all-time"],
    default: "all-time",
  },
  productId: {
    type: String,
    required: true,
    default: "",
  },
  priceId: {
    type: String,
    required: true,
    default: "",
  },
});

const Plan = model<PlanDocument>("Plan", planSchema);
export default Plan;
