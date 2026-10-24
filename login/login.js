
function switchForm(type) {

    const loginForm =
        document.getElementById("loginForm");

    const registerForm =
        document.getElementById("registerForm");

    const btnLogin =
        document.getElementById("btnShowLogin");

    const btnReg =
        document.getElementById("btnShowRegister");

    const formTitle =
        document.getElementById("formTitle");

    const msgBox =
        document.getElementById("msgBox");


    msgBox.style.display = "none";


    if (type === "login") {

        loginForm.classList.remove("d-none");

        registerForm.classList.add("d-none");

        btnLogin.classList.add("active");

        btnReg.classList.remove("active");

        formTitle.innerText = "ĐĂNG NHẬP";

    } else {

        loginForm.classList.add("d-none");

        registerForm.classList.remove("d-none");

        btnLogin.classList.remove("active");

        btnReg.classList.add("active");

        formTitle.innerText = "ĐĂNG KÝ";
    }
}


function submitForm(message) {

    const msgBox =
        document.getElementById("msgBox");

    msgBox.innerText = message;

    msgBox.style.display = "block";


    setTimeout(function() {

        msgBox.style.display = "none";

    }, 3500);
}


async function tao_tai_khoan() {
    const nameRegister = document.getElementById("registerName").value.trim();
    const passwordRegister = document.getElementById("registerPassword").value;
    const emailRegister = document.getElementById("registerEmail").value.trim();
    const registerConfirmPassword = document.getElementById("registerConfirmPassword").value;

    if (
        nameRegister === "" ||
        passwordRegister === "" ||
        emailRegister === "" ||
        registerConfirmPassword === ""
    ) {
        submitForm("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    if (passwordRegister !== registerConfirmPassword) {
        submitForm("Mật khẩu không khớp!");
        return;
    }

    try {
        const response = await fetch(
            "https://mindx-class-api.vercel.app/api"
        );

        const users = await response.json();

        const userExists = users.some(function(user) {
            return (
                String(user.name).toLowerCase() === nameRegister.toLowerCase() ||
                String(user.email).toLowerCase() === emailRegister.toLowerCase()
            );
        });

        if (userExists) {
            submitForm("Tài khoản hoặc email đã tồn tại!");
            return;
        }

        const registerResponse = await fetch(
            "https://mindx-class-api.vercel.app/api",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id_class: "JSA17-JSA17",
                    name: nameRegister,
                    password: passwordRegister,
                    email: emailRegister
                })
            }
        );

        if (!registerResponse.ok) {
            throw new Error("Đăng ký thất bại");
        }

        submitForm("Đăng ký thành công! 🎉");

        document.getElementById("registerName").value = "";
        document.getElementById("registerPassword").value = "";
        document.getElementById("registerEmail").value = "";
        document.getElementById("registerConfirmPassword").value = "";

        setTimeout(function() {
            switchForm("login");
        }, 1500);

    } catch (error) {
        console.log(error);
        submitForm("Có lỗi khi kết nối API!");
    }
}

async function login() {
    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value;

    if (username === "" || password === "") {
        submitForm("Vui lòng nhập tên đăng nhập và mật khẩu!");
        return;
    }

    try {
        const response = await fetch(
            "https://mindx-class-api.vercel.app/api"
        );

        if (!response.ok) {
            throw new Error("Không lấy được dữ liệu!");
        }

        const users = await response.json();

        console.log("Danh sách tài khoản:", users);

        const user = users.find(function(u) {
            return (
                String(u.name).trim() === username &&
                String(u.password) === password
            );
        });
        if (user) {
            submitForm("Đăng nhập thành công! 🎉");

            localStorage.setItem(
                "currentUser",
                JSON.stringify(user)
            );

            setTimeout(function() {
                window.location.href = "../main/index.html";
            }, 1000);

        } else {
            submitForm("Sai tên đăng nhập hoặc mật khẩu!");
        }

    } catch (error) {
        console.log("Lỗi:", error);
        submitForm("Không thể kết nối với API!");
    }
}