-- Add a deny-all policy for api_keys (service role bypasses RLS)
CREATE POLICY "No public access to api_keys" ON public.api_keys FOR SELECT USING (false);

-- Seed well-known KNX manufacturers
INSERT INTO public.manufacturers (id, knx_manufacturer_id, hex_code, name, short_name, country, website_url, product_count) VALUES
('mfr_0001', 'M-0001', '0001', 'Siemens AG', 'Siemens', 'DE', 'https://www.siemens.com', 245),
('mfr_0002', 'M-0002', '0002', 'ABB Stotz-Kontakt GmbH', 'ABB', 'DE', 'https://www.abb.com', 198),
('mfr_0004', 'M-0004', '0004', 'Albrecht Jung GmbH & Co. KG', 'Jung', 'DE', 'https://www.jung.de', 156),
('mfr_0006', 'M-0006', '0006', 'Hager Electro GmbH & Co. KG', 'Hager', 'DE', 'https://www.hager.com', 89),
('mfr_0007', 'M-0007', '0007', 'Merten GmbH (Schneider Electric)', 'Merten', 'DE', 'https://www.se.com', 134),
('mfr_0008', 'M-0008', '0008', 'Gira Giersiepen GmbH & Co. KG', 'Gira', 'DE', 'https://www.gira.de', 147),
('mfr_000c', 'M-000C', '000C', 'Busch-Jaeger Elektro GmbH', 'Busch-Jaeger', 'DE', 'https://www.busch-jaeger.de', 178),
('mfr_0019', 'M-0019', '0019', 'BERKER GmbH & Co. KG', 'Berker', 'DE', 'https://www.berker.de', 67),
('mfr_0024', 'M-0024', '0024', 'Theben AG', 'Theben', 'DE', 'https://www.theben.de', 92),
('mfr_0025', 'M-0025', '0025', 'WAGO Kontakttechnik GmbH & Co. KG', 'WAGO', 'DE', 'https://www.wago.com', 45),
('mfr_002b', 'M-002B', '002B', 'Schneider Electric Industries SAS', 'Schneider Electric', 'FR', 'https://www.se.com', 167),
('mfr_0049', 'M-0049', '0049', 'WEINZIERL ENGINEERING GmbH', 'Weinzierl', 'DE', 'https://www.weinzierl.de', 34),
('mfr_004c', 'M-004C', '004C', 'MDT technologies GmbH', 'MDT', 'DE', 'https://www.mdt.de', 112),
('mfr_0064', 'M-0064', '0064', 'MEAN WELL Enterprises Co. Ltd.', 'MEAN WELL', 'TW', 'https://www.meanwell.com', 18),
('mfr_0071', 'M-0071', '0071', 'Zennio Avance y Tecnología S.L.', 'Zennio', 'ES', 'https://www.zennio.com', 56),
('mfr_0080', 'M-0080', '0080', 'Elsner Elektronik GmbH', 'Elsner', 'DE', 'https://www.elsner-elektronik.de', 43),
('mfr_00c5', 'M-00C5', '00C5', 'Loxone Electronics GmbH', 'Loxone', 'AT', 'https://www.loxone.com', 28),
('mfr_00e1', 'M-00E1', '00E1', 'DALI AG', 'DALI', 'DE', NULL, 12),
('mfr_0104', 'M-0104', '0104', 'Intesis Software SLU', 'Intesis', 'ES', 'https://www.intesis.com', 31),
('mfr_0162', 'M-0162', '0162', 'Basalte BVBA', 'Basalte', 'BE', 'https://www.basalte.be', 22);

-- Seed some products
INSERT INTO public.products (id, knx_product_id, knx_hardware_id, manufacturer_id, name, order_number, description, medium_types, bus_current_ma, is_coupler, is_ip_device, is_power_supply) VALUES
('prod_0008_h0012', 'M-0008_H-0012', 'H-0012', 'mfr_0008', 'Switch Actuator 8-fold 16A', '1164 00', '8-channel switch actuator for DIN rail mounting, 16A per channel', '{TP}', 12.0, false, false, false),
('prod_0008_h0018', 'M-0008_H-0018', 'H-0018', 'mfr_0008', 'Dimming Actuator 4-fold', '2172 00', '4-channel universal dimming actuator', '{TP}', 24.0, false, false, false),
('prod_0001_h0156', 'M-0001_H-0156', 'H-0156', 'mfr_0001', 'Switch Actuator N 512/02', '5WG1 512-1AB02', 'Binary output 12-fold 16A', '{TP}', 10.0, false, false, false),
('prod_004c_h0001', 'M-004C_H-0001', 'H-0001', 'mfr_004c', 'AKS-0816.03', 'AKS-0816.03', 'Switch Actuator 8-fold 16A', '{TP}', 10.0, false, false, false),
('prod_0002_h0089', 'M-0002_H-0089', 'H-0089', 'mfr_0002', 'SA/S 8.16.5.2', '2CDG110264R0011', 'Switch Actuator 8-fold 16A', '{TP}', 12.0, false, false, false);

-- Seed some application programs
INSERT INTO public.application_programs (id, knx_application_id, knx_program_id, manufacturer_id, product_id, name, version, application_number, communication_object_count, max_group_address_links) VALUES
('app_0008_a003400ab01', 'M-0008_A-0034-00-AB01', 'A-0034-00-AB01', 'mfr_0008', 'prod_0008_h0012', 'Switch Actuator 8x16A v2.1', '2.1', '0034', 48, 254),
('app_0008_a003400ab02', 'M-0008_A-0034-00-AB02', 'A-0034-00-AB02', 'mfr_0008', 'prod_0008_h0012', 'Switch Actuator 8x16A v3.0', '3.0', '0034', 56, 254),
('app_0008_a004200cd01', 'M-0008_A-0042-00-CD01', 'A-0042-00-CD01', 'mfr_0008', 'prod_0008_h0018', 'Dimming Actuator 4x v3.0', '3.0', '0042', 36, 254);

-- Seed DPTs (most common ones)
INSERT INTO public.dpts (id, dpt_id, number, main_number, sub_number, name, description, size_bits, unit, range_low, range_high, encoding_description) VALUES
('dpt_1_001', 'DPST-1-1', '1.001', 1, 1, 'DPT_Switch', 'On/Off switch', 1, NULL, 'Off', 'On', '0 = Off, 1 = On'),
('dpt_1_002', 'DPST-1-2', '1.002', 1, 2, 'DPT_Bool', 'Boolean', 1, NULL, 'false', 'true', '0 = false, 1 = true'),
('dpt_1_003', 'DPST-1-3', '1.003', 1, 3, 'DPT_Enable', 'Enable/Disable', 1, NULL, 'Disable', 'Enable', '0 = Disable, 1 = Enable'),
('dpt_1_008', 'DPST-1-8', '1.008', 1, 8, 'DPT_UpDown', 'Up/Down', 1, NULL, 'Up', 'Down', '0 = Up, 1 = Down'),
('dpt_1_009', 'DPST-1-9', '1.009', 1, 9, 'DPT_OpenClose', 'Open/Close', 1, NULL, 'Open', 'Close', '0 = Open, 1 = Close'),
('dpt_1_010', 'DPST-1-10', '1.010', 1, 10, 'DPT_Start', 'Start/Stop', 1, NULL, 'Stop', 'Start', '0 = Stop, 1 = Start'),
('dpt_2_001', 'DPST-2-1', '2.001', 2, 1, 'DPT_Switch_Control', 'Switch control with priority', 2, NULL, 'No control', 'Control', 'Bit 0: value, Bit 1: control'),
('dpt_3_007', 'DPST-3-7', '3.007', 3, 7, 'DPT_Control_Dimming', 'Dimming control', 4, NULL, 'Decrease', 'Increase', '4-bit dimming stepcode'),
('dpt_3_008', 'DPST-3-8', '3.008', 3, 8, 'DPT_Control_Blinds', 'Blind control', 4, NULL, 'Down', 'Up', '4-bit blind stepcode'),
('dpt_5_001', 'DPST-5-1', '5.001', 5, 1, 'DPT_Scaling', 'Percentage (0..100%)', 8, '%', '0', '100', '0 = 0%, 255 = 100%'),
('dpt_5_003', 'DPST-5-3', '5.003', 5, 3, 'DPT_Angle', 'Angle (0..360°)', 8, '°', '0', '360', '0 = 0°, 255 = 360°'),
('dpt_5_004', 'DPST-5-4', '5.004', 5, 4, 'DPT_Percent_U8', 'Percentage (0..255%)', 8, '%', '0', '255', 'Unsigned 8-bit percentage'),
('dpt_5_010', 'DPST-5-10', '5.010', 5, 10, 'DPT_Value_1_Ucount', 'Counter (0..255)', 8, 'counter pulses', '0', '255', 'Unsigned 8-bit counter'),
('dpt_6_001', 'DPST-6-1', '6.001', 6, 1, 'DPT_Percent_V8', 'Percentage (-128..127%)', 8, '%', '-128', '127', 'Signed 8-bit percentage'),
('dpt_7_001', 'DPST-7-1', '7.001', 7, 1, 'DPT_Value_2_Ucount', 'Counter (0..65535)', 16, 'pulses', '0', '65535', 'Unsigned 16-bit counter'),
('dpt_8_001', 'DPST-8-1', '8.001', 8, 1, 'DPT_Value_2_Count', 'Counter (-32768..32767)', 16, 'pulses', '-32768', '32767', 'Signed 16-bit counter'),
('dpt_9_001', 'DPST-9-1', '9.001', 9, 1, 'DPT_Value_Temp', 'Temperature (°C)', 16, '°C', '-273', '670760', '2-byte float'),
('dpt_9_002', 'DPST-9-2', '9.002', 9, 2, 'DPT_Value_Tempd', 'Temperature difference (K)', 16, 'K', '-670760', '670760', '2-byte float'),
('dpt_9_004', 'DPST-9-4', '9.004', 9, 4, 'DPT_Value_Lux', 'Light intensity (Lux)', 16, 'lx', '0', '670760', '2-byte float'),
('dpt_9_005', 'DPST-9-5', '9.005', 9, 5, 'DPT_Value_Wsp', 'Wind speed (m/s)', 16, 'm/s', '0', '670760', '2-byte float'),
('dpt_9_007', 'DPST-9-7', '9.007', 9, 7, 'DPT_Value_Humidity', 'Humidity (%)', 16, '%', '0', '670760', '2-byte float'),
('dpt_10_001', 'DPST-10-1', '10.001', 10, 1, 'DPT_TimeOfDay', 'Time of day', 24, NULL, NULL, NULL, 'Day/hour/minute/second'),
('dpt_11_001', 'DPST-11-1', '11.001', 11, 1, 'DPT_Date', 'Date', 24, NULL, NULL, NULL, 'Day/month/year'),
('dpt_12_001', 'DPST-12-1', '12.001', 12, 1, 'DPT_Value_4_Ucount', 'Counter (0..4294967295)', 32, 'counter pulses', '0', '4294967295', 'Unsigned 32-bit counter'),
('dpt_13_001', 'DPST-13-1', '13.001', 13, 1, 'DPT_Value_4_Count', 'Counter (-2147483648..2147483647)', 32, 'counter pulses', '-2147483648', '2147483647', 'Signed 32-bit counter'),
('dpt_13_010', 'DPST-13-10', '13.010', 13, 10, 'DPT_ActiveEnergy', 'Active energy (Wh)', 32, 'Wh', '-2147483648', '2147483647', 'Signed 32-bit Wh'),
('dpt_14_019', 'DPST-14-19', '14.019', 14, 19, 'DPT_Value_Electric_Current', 'Electric current (A)', 32, 'A', NULL, NULL, '4-byte float IEEE 754'),
('dpt_14_027', 'DPST-14-27', '14.027', 14, 27, 'DPT_Value_Electric_Potential', 'Electric potential (V)', 32, 'V', NULL, NULL, '4-byte float IEEE 754'),
('dpt_14_056', 'DPST-14-56', '14.056', 14, 56, 'DPT_Value_Power', 'Power (W)', 32, 'W', NULL, NULL, '4-byte float IEEE 754'),
('dpt_16_000', 'DPST-16-0', '16.000', 16, 0, 'DPT_String_ASCII', 'ASCII string (14 chars)', 112, NULL, NULL, NULL, '14-character ASCII string'),
('dpt_16_001', 'DPST-16-1', '16.001', 16, 1, 'DPT_String_8859_1', 'ISO 8859-1 string (14 chars)', 112, NULL, NULL, NULL, '14-character Latin-1 string'),
('dpt_17_001', 'DPST-17-1', '17.001', 17, 1, 'DPT_SceneNumber', 'Scene number (0..63)', 8, NULL, '0', '63', '6-bit scene number'),
('dpt_18_001', 'DPST-18-1', '18.001', 18, 1, 'DPT_SceneControl', 'Scene control', 8, NULL, NULL, NULL, 'Bit 7: learn, Bits 0-5: scene number'),
('dpt_20_102', 'DPST-20-102', '20.102', 20, 102, 'DPT_HVACMode', 'HVAC mode', 8, NULL, 'Auto', 'Comfort/Standby/Economy/Protection', '0=Auto,1=Comfort,2=Standby,3=Economy,4=Protection'),
('dpt_232_600', 'DPST-232-600', '232.600', 232, 600, 'DPT_Colour_RGB', 'RGB colour value', 24, NULL, '0 0 0', '255 255 255', '3-byte RGB (R,G,B)');