from playwright.sync_api import sync_playwright
import google.generativeai as genai
from dotenv import load_dotenv
import time
import os
import boto3
import uuid

load_dotenv()

def join_meeting(meet_url: str):
    with sync_playwright() as p:
        profile_path = os.path.join(os.getcwd(), "bot_profile")
        
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile_path,
            headless=False, 
            viewport={"width": 1280, "height": 720}, 
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1280,720', 
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--disable-audio-output',
                '--disable-blink-features=AutomationControlled'
            ],
            permissions=['microphone', 'camera']
        )
        
        page = context.pages[0] 

        # ==========================================
        # 📸 DEBUG CAMERA SETUP
        # ==========================================
        def debug_screenshot(filename="debug_crash.png"):
            print(f"📸 Snapping debug screenshot: {filename}...")
            try:
                page.screenshot(path=filename)
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                    region_name=os.environ.get("AWS_REGION", "eu-north-1")
                )
                bucket = os.environ.get("AWS_BUCKET_NAME")
                s3_client.upload_file(filename, bucket, filename)
                print(f"✅ Uploaded to S3! Go look at '{filename}' in your AWS bucket.")
            except Exception as e:
                print(f"❌ Failed to take or upload screenshot: {e}")

        # ==========================================
        # 🤖 PHASE 1: JOINING THE MEETING
        # ==========================================
        try:
            print(f"Step 1: Navigating to {meet_url}...")
            page.goto(meet_url, timeout=60000, wait_until="domcontentloaded")
            time.sleep(5) # Give the heavy Google Meet UI time to load

            if "workspace.google.com/products/meet" in page.url or "You can't join this video call" in page.content():
                print("\n--- 🛑 GOOGLE BLOCKED US ---")
                debug_screenshot("debug_google_blocked.png")
                try: context.close() 
                except: pass
                return {"error": "Blocked by Google"}

            print("Step 2: Muting Microphone and Camera...")
            page.keyboard.press("Control+d") 
            time.sleep(1)
            page.keyboard.press("Control+e") 
            time.sleep(1)

            print("Step 3: Checking if Google Meet requires a name...")
            try:
                # Look for ANY text input box that might be the name field
                name_input = page.locator('input[type="text"], input[aria-label="Your name"], input[placeholder="Your name"]').first
                name_input.wait_for(state="visible", timeout=5000)
                name_input.fill("CogniMeet Bot")
                print("✅ Filled in anonymous name!")
                time.sleep(1.5) # Crucial: Wait for the button to unlock
            except Exception:
                print("No name input required. Proceeding...")

            print("Step 4: Looking for 'Ask to join' button...")
            try:
                join_button = page.locator('button:has-text("Ask to join"), button:has-text("Join now")').first
                join_button.wait_for(state="visible", timeout=10000)
                join_button.click()
                print("🚪 Knocked on the door! (PLEASE ADMIT THE BOT FROM YOUR HOST ACCOUNT)")
            except Exception as e:
                print(f"❌ Could not find the Join button.")
                debug_screenshot("debug_join_button_missing.png")
                raise e # Force it into the crash handler

            print("Step 5: ⏳ Waiting to be admitted... (Timeout in 60 seconds)")
            try:
                hangup_button = page.locator('button[aria-label*="Leave call" i]')
                hangup_button.wait_for(state="visible", timeout=60000)
                print("✅ Successfully entered the meeting room!")
            except Exception:
                print("❌ Bot was not admitted in time. Leaving.")
                debug_screenshot("debug_not_admitted.png")
                try: context.close() 
                except: pass
                return {"error": "Not admitted"}

        except Exception as crash_error:
            print(f"❌ CRITICAL CRASH DURING JOIN SEQUENCE: {crash_error}")
            debug_screenshot("debug_critical_crash.png")
            try: context.close() 
            except: pass
            return {"error": str(crash_error)}
        
        time.sleep(3)
        
        # ==========================================
        # 🎙️ PHASE 2: CAPTIONS AND TRANSCRIPTION
        # ==========================================
        print("Checking caption status...")
        try:
            page.mouse.move(100, 100)
            time.sleep(0.5)
            page.mouse.move(640, 360) 
            time.sleep(1)

            caption_button = page.locator('button[aria-label*="caption" i]').first
            caption_button.wait_for(state="visible", timeout=3000)

            label = caption_button.get_attribute("aria-label").lower()
            if "turn off" in label:
                print("✅ Captions were already enabled!")
            elif "turn on" in label:
                caption_button.click()
                print("✅ Clicked CC button via UI!")
        except Exception as e:
            print(f"UI Button failed, forcing shortcut: {e}")
            page.mouse.click(640, 360) 
            time.sleep(0.5)
            page.keyboard.press("c")
            print("✅ Used shortcut 'c' fallback!")
        
        time.sleep(2)

        print("\n=== 🎙️ LISTENING TO MEETING ===")
        print("Bot will leave if you end the call, or after 10 minutes maximum.")
        
        last_text = ""
        NOISE_WORDS = ["language", "English", "format_size", "Font size", "circle", "Font color", "settings", "Open caption settings"]
        
        start_time = time.time()
        max_duration = 10 * 60  
        
        with open("transcript.txt", "w", encoding="utf-8") as f:
            while True:
                elapsed_time = time.time() - start_time
                if elapsed_time > max_duration:
                    print("\n⏱️ 10-minute maximum reached. Bot is packing up.")
                    break
                
                try:
                    if not hangup_button.is_visible():
                        print("\n🚪 Meeting ended or bot was removed. Packing up early!")
                        break
                except Exception:
                    print("\n🚪 Browser tab closed unexpectedly. Packing up early!")
                    break

                try:
                    captions_elements = page.locator('.CNusmb, .iTTPOb, .a4cQT').all_inner_texts()
                    if captions_elements:
                        clean_captions = [text.strip() for text in captions_elements if text.strip() not in NOISE_WORDS and text.strip() != ""]
                        current_text = " ".join(clean_captions).strip()
                        
                        if current_text and current_text != last_text:
                            print(f"Bot heard: {current_text}")
                            f.write(current_text + " ")
                            f.flush() 
                            last_text = current_text
                except Exception:
                    pass
                
                time.sleep(1.5)

        print("--- Closing Browser ---")
        try:
            context.close()
        except Exception:
            print("Browser was already closed. Moving on!")

    # ==========================================
    # 🧠 PHASE 3: AI SUMMARIZATION & CLOUD STORAGE
    # ==========================================
    print("\n=== 🧠 SENDING DATA TO GEMINI ===")
    
    try:
        with open("transcript.txt", "r", encoding="utf-8") as f:
            transcript_content = f.read()

        if len(transcript_content.strip()) < 10:
            print("Transcript too short. Nobody talked!")
            return {"error": "Transcript empty"}

        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        if not available_models:
             return {"error": "No valid models found for this API key."}
             
        target_model = next((m for m in available_models if 'flash' in m), available_models[0])
        model = genai.GenerativeModel(target_model)

        prompt = f"""
        You are an elite executive assistant. Read the following meeting transcript and generate a highly structured, professional summary. 
        Format your response with the following headers:
        
        ## 📝 Meeting Overview
        (A 2-3 sentence summary of what the meeting was generally about)
        
        ## 🔑 Key Discussion Points
        (Bullet points of the main topics discussed)
        
        ## 🚀 Action Items
        (A numbered list of tasks that need to be done, and who should do them if mentioned)

        Here is the raw transcript:
        "{transcript_content}"
        """

        response = model.generate_content(prompt)
        ai_summary = response.text
        
        print("✅ Summary successfully generated!")

        with open("summary.txt", "w", encoding="utf-8") as f:
            f.write(ai_summary)
            
        print("☁️ Uploading summary to AWS S3...")
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                region_name=os.environ.get("AWS_REGION", "eu-north-1")
            )
            
            unique_id = str(uuid.uuid4())[:8]
            s3_file_name = f"summary_{unique_id}.txt"
            bucket_name = os.environ.get("AWS_BUCKET_NAME")
            
            s3_client.upload_file("summary.txt", bucket_name, s3_file_name)
            print(f"🏆 SUCCESS! File uploaded to S3 bucket '{bucket_name}' as '{s3_file_name}'")
            
            return {"status": "Success", "summary": ai_summary}
            
        except Exception as s3_error:
            print(f"❌ AWS Upload failed: {s3_error}")
            return {"status": "Success (Local Only)", "summary": ai_summary, "error": "S3 Upload failed"}

    except Exception as e:
        print(f"❌ Failed to generate AI summary: {e}")
        return {"error": str(e)}