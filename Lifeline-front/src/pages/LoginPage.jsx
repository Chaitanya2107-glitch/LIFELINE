import { Link } from "react-router-dom";
function LoginPage() {

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
      <div className="bg-white shadow-xl rounded-3xl p-10 w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-blue-600 mb-2">
          Lifeline
        </h1>

        <p className="text-center text-slate-600 mb-8">
          Welcome back.
        </p>

        <input
          type="email"
          placeholder="Email"
          className="w-full border border-slate-300 rounded-xl p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full border border-slate-300 rounded-xl p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

       <Link
  to="/dashboard"
  className="block w-full bg-blue-600 text-white text-center rounded-xl py-4"
>
  Login
</Link>
      </div>
    </div>
  );
}

export default LoginPage;