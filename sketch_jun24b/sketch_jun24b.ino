#include <WiFi.h>
#include <HTTPClient.h>
#include "base64.h"
#include <driver/i2s.h>

#define I2S_WS  5
#define I2S_SD  4
#define I2S_SCK 6

#define SAMPLE_RATE     16000
#define RECORD_SECONDS  3
#define BUFFER_SIZE     (SAMPLE_RATE * 2 * RECORD_SECONDS)  // 16bit = 2 bytes/sample
#define SERVER_URL      "https://bot-test-fvhl.onrender.com/upload"

uint8_t audioBuffer[BUFFER_SIZE];

void setupI2S() {
  i2s_config_t i2s_config = {
    .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 1024,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = -1,
    .data_in_num = I2S_SD
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
}

void setup() {
  Serial.begin(115200);
  WiFi.begin("VNPT-IT.AP.VNPT-IT.KV5-NEW", "VNPTIT@2025");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi đã kết nối!");
  setupI2S();
}

void loop() {
  Serial.println("🎤 Đang ghi 3s...");

  size_t bytesRead;
  i2s_read(I2S_NUM_0, audioBuffer, BUFFER_SIZE, &bytesRead, portMAX_DELAY);

  // Encode base64
  String encoded = base64::encode(audioBuffer, bytesRead);

  // Gửi lên server
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"audio\":\"" + encoded + "\"}";
  Serial.println("📦 JSON gửi:");
  Serial.println(body.substring(0, 100) + "...");  // chỉ in 100 ký tự đầu

  int code = http.POST(body);
  Serial.printf("📤 Kết quả gửi: %d\n", code);

  http.end();
  delay(5000);  // chờ 5 giây rồi ghi tiếp
}