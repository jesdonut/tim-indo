import { redirect } from "next/navigation"

// No sign-in any more — go straight into the app.
export default function Home() {
  redirect("/leopalace")
}
