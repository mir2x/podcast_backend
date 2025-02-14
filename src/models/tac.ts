import { Schema, model } from "mongoose";
import { TaCSchema } from "@schemas/tac";

const tacSchema = new Schema<TaCSchema>({
  text: {
    type: String,
  },
});

const TaC = model<TaCSchema>("TaC", tacSchema);
export default TaC;
