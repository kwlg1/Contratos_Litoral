<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Recebe os dados do seu JavaScript
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$apiToken = "YQdykbfU-J-IlBrlChFQbnB85ZdrkjRlO9FCAxcjjufibRZaDdAFwWxt_HVpPPiG"; // Fica seguro aqui no servidor
$url = "https://api.assinafy.com.br/api/v1/documents";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $apiToken",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
?>