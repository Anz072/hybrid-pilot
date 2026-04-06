import axios from "axios";

export const baseApi = axios.create({
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});