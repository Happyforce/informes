const LOGO_DARK =
  "https://myhappyforce.com/wp-content/uploads/2020/01/logo-happyforce-dark-1.png";

export default function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DARK} alt="Happyforce" style={{ filter: "brightness(2)" }} />
        <span>
          &copy; Happyforce ·{" "}
          <a
            href="https://myhappyforce.com/es/"
            target="_blank"
            rel="noopener noreferrer"
          >
            myhappyforce.com
          </a>
        </span>
      </div>
    </footer>
  );
}
