import { Request, Response, NextFunction } from "express";
import { AuthValidatorSchema } from "@validator/input";
import { fromZodError } from "zod-validation-error";
import createError from "http-errors";

export const validateRegisterInput = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const result = AuthValidatorSchema.safeParse(req.body);
  if (!result.success) {
    return next(createError(400, fromZodError(result.error)));
  }
  next();
};