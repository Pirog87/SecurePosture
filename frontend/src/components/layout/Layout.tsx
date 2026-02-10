import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout() {
  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <div className="content">
          <div className="view-enter">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
