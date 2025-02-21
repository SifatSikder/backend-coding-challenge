import bcrypt from "bcrypt";
import { Request, Response } from "express";

import User from "../models/User";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../constants/messages";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import jwt from "jsonwebtoken";
import { addToBlacklist } from "../utils/redis";

export const signup = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
    });

    await user.save();
    res.status(201).json({ message: SUCCESS_MESSAGES.USER_CREATED });
  } catch (err: Error | any) {
    if (err.code === 11000) {
      res.status(400).json({ error: ERROR_MESSAGES.SIGNUP_FAILED });
    } else {
      res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: ERROR_MESSAGES.INVALID_CREDENTIALS });
      return;
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res
      .status(200)
      .json({ message: SUCCESS_MESSAGES.LOGIN_SUCCESSFUL, accessToken });
  } catch (error) {
    res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET || "default_secret"
    ) as {
      exp?: number;
    };

    if (decoded.exp) {
      const timeUntilExpiry = decoded.exp - Math.floor(Date.now() / 1000);
      await addToBlacklist(token, timeUntilExpiry);
    }

    res.clearCookie("refreshToken");
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};
