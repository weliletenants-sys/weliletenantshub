import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ContentTransition, 
  FadeTransition, 
  SlideUpTransition, 
  StaggeredList 
} from './ContentTransition';

/**
 * Demo component showing different transition types
 * For development and documentation purposes
 */
export const TransitionDemo = () => {
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [show3, setShow3] = useState(true);
  const [show4, setShow4] = useState(true);

  const triggerTransition1 = () => {
    setLoading1(true);
    setTimeout(() => setLoading1(false), 2000);
  };

  const triggerTransition2 = () => {
    setLoading2(true);
    setTimeout(() => setLoading2(false), 2000);
  };

  const mockItems = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];

  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold">Transition Demos</h1>

      {/* Demo 1: ContentTransition */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">1. ContentTransition</h2>
        <p className="text-muted-foreground">
          Full content transition with skeleton fade-out and content fade-in + slide-up
        </p>
        <Button onClick={triggerTransition1}>Trigger Transition</Button>
        
        <ContentTransition
          loading={loading1}
          skeleton={
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          }
        >
          <Card className="animate-reveal">
            <CardHeader>
              <CardTitle>Content Loaded!</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This content smoothly transitioned in after the skeleton faded out.</p>
              <p className="mt-2">Notice the subtle slide-up and scale effect.</p>
            </CardContent>
          </Card>
        </ContentTransition>
      </div>

      {/* Demo 2: Multiple Cards with ContentTransition */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">2. Multiple Cards</h2>
        <p className="text-muted-foreground">
          Multiple cards transitioning together
        </p>
        <Button onClick={triggerTransition2}>Trigger Transition</Button>
        
        <ContentTransition
          loading={loading2}
          skeleton={
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-3 gap-4 animate-reveal">
            {[1, 2, 3].map((i) => (
              <Card key={i} className={`stagger-${i}`}>
                <CardHeader>
                  <CardTitle>Card {i}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">1,234</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ContentTransition>
      </div>

      {/* Demo 3: FadeTransition */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">3. FadeTransition</h2>
        <p className="text-muted-foreground">
          Simple fade in/out without skeleton
        </p>
        <Button onClick={() => setShow3(!show3)}>Toggle</Button>
        
        <FadeTransition show={show3}>
          <Card>
            <CardHeader>
              <CardTitle>Fade Only</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This just fades in and out smoothly without position changes.</p>
            </CardContent>
          </Card>
        </FadeTransition>
      </div>

      {/* Demo 4: SlideUpTransition */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">4. SlideUpTransition</h2>
        <p className="text-muted-foreground">
          Slide up with fade for individual elements
        </p>
        <Button onClick={() => setShow4(!show4)}>Toggle</Button>
        
        <div className="grid grid-cols-3 gap-4">
          <SlideUpTransition show={show4} delay={0}>
            <Card>
              <CardContent className="p-4">
                <p className="font-semibold">Card 1</p>
                <p className="text-sm text-muted-foreground">No delay</p>
              </CardContent>
            </Card>
          </SlideUpTransition>
          
          <SlideUpTransition show={show4} delay={100}>
            <Card>
              <CardContent className="p-4">
                <p className="font-semibold">Card 2</p>
                <p className="text-sm text-muted-foreground">100ms delay</p>
              </CardContent>
            </Card>
          </SlideUpTransition>
          
          <SlideUpTransition show={show4} delay={200}>
            <Card>
              <CardContent className="p-4">
                <p className="font-semibold">Card 3</p>
                <p className="text-sm text-muted-foreground">200ms delay</p>
              </CardContent>
            </Card>
          </SlideUpTransition>
        </div>
      </div>

      {/* Demo 5: StaggeredList */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">5. StaggeredList</h2>
        <p className="text-muted-foreground">
          List items appearing one by one with automatic stagger
        </p>
        
        <StaggeredList show={true} staggerDelay={75} className="space-y-2">
          {mockItems.map((item) => (
            <Card key={item}>
              <CardContent className="p-4">
                <p className="font-semibold">{item}</p>
              </CardContent>
            </Card>
          ))}
        </StaggeredList>
      </div>

      {/* Timing Guide */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Timing Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>ContentTransition:</strong> 300ms fade-out → 150ms delay → 500ms fade-in</p>
          <p><strong>FadeTransition:</strong> 300ms fade</p>
          <p><strong>SlideUpTransition:</strong> 500ms slide + fade</p>
          <p><strong>StaggeredList:</strong> 50-100ms per item (customizable)</p>
          <p className="text-muted-foreground mt-4">
            All transitions use cubic-bezier(0.4, 0, 0.2, 1) for smooth easing
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
