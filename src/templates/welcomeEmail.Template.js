export const welcomeEmailTemplate = (name) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body{
            font-family: Arial, sans-serif;
            background:#f8fafc;
            padding:20px;
        }

        .container{
            background:white;
            max-width:600px;
            margin:auto;
            padding:30px;
            border-radius:10px;
        }

        .button{
            display:inline-block;
            padding:12px 20px;
            background:#2563eb;
            color:white;
            text-decoration:none;
            border-radius:6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Hello ${name},</h2>

        <p>
            Welcome to CFI V2.0.
        </p>

        <p>
            Thank you for registering with us.
        </p>

        <a href="#" class="button">
            Get Started
        </a>
    </div>
</body>
</html>
`;